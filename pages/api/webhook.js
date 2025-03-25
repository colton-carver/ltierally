import Stripe from "stripe"
import { buffer } from "micro"
import clientPromise from "../../lib/mongodb"

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const sig = req.headers["stripe-signature"]
    let event

    try {
      const buf = await buffer(req)
      const bodyString = buf.toString()
      console.log("Webhook received, processing...")

      event = stripe.webhooks.constructEvent(bodyString, sig, process.env.STRIPE_WEBHOOK_SECRET)
      console.log("Webhook verified, event type:", event.type)
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`)
      return res.status(400).json({ error: `Webhook Error: ${err.message}` })
    }

    // Handle the event
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object
      console.log("Payment succeeded:", paymentIntent.id)

      try {
        console.log("Connecting to MongoDB from webhook...")
        const client = await clientPromise
        const db = client.db("aliceingreekland")

        console.log("Updating donation status to completed...")
        const result = await db
          .collection("donations")
          .updateOne({ paymentIntentId: paymentIntent.id }, { $set: { status: "completed" } })
        console.log("Update result:", result)

        if (result.matchedCount === 0) {
          console.log("No matching donation found, creating new one from webhook data")
          // If no donation was found, create one from the payment intent metadata
          const { donorName, donorEmail, memberCredited, memberSlug } = paymentIntent.metadata

          const newDonation = {
            paymentIntentId: paymentIntent.id,
            donorName,
            donorEmail,
            amount: (paymentIntent.amount / 100).toFixed(2), // Convert cents to dollars
            memberCredited,
            memberSlug,
            status: "completed",
            timestamp: new Date().toISOString(),
          }

          const insertResult = await db.collection("donations").insertOne(newDonation)
          console.log("New donation created from webhook:", insertResult)
        }
      } catch (dbError) {
        console.error("Database error in webhook:", dbError)
      }
    }

    res.status(200).json({ received: true })
  } else {
    res.setHeader("Allow", ["POST"])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}

