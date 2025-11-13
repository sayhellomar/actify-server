const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const decoded = Buffer.from(process.env.FIREBASE_ADMIN_KEY, "base64").toString(
    "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const verifyFirebaseToken = async (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized Access" });
    }
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
        return res.status(401).send({ message: "Unauthorized Access" });
    }

    try {
        const userInfo = await admin.auth().verifyIdToken(token);
        req.token_email = userInfo.email;
        next();
    } catch {
        return res.status(401).send({ message: "Unauthorized Access" });
    }
};

const uri = `mongodb+srv://${process.env.ACTIFY_DB_USER}:${process.env.ACTIFY_DB_PASSWORD}@cluster0.apxhxix.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

const run = async () => {
    try {
        // await client.connect();

        const database = client.db("actify");
        const users = database.collection("users");
        const events = database.collection("events");
        const joinedEvent = database.collection("joined_event");

        // Users API
        app.get("/users", verifyFirebaseToken, async (req, res) => {
            const email = req.query.email;
            const query = {};
            if (email) {
                query.email = email;
            }
            const cursor = users.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.post("/users", async (req, res) => {
            const user = req.body;
            const email = user.email;
            // user.email = email;
            const query = { email: email };
            const existingUser = await users.findOne(query);
            if (existingUser) {
                res.send({ message: "User is already exists" });
            } else {
                const result = await users.insertOne(user);
                res.send(result);
            }
        });

        // Event API
        app.get("/events", verifyFirebaseToken, async (req, res) => {
            const email = req.query.email;
            const userEmail = req.token_email;
            const query = {};
            if (email) {
                query.email = email;
                if (email !== userEmail) {
                    return res.status(403).send({ message: "Forbidden" });
                }
            }
            const cursor = events.find(query).sort({ eventDate: 1 });
            const result = await cursor.toArray();
            res.send(result);
        });

        app.post("/events", verifyFirebaseToken, async (req, res) => {
            const newEvent = req.body;
            const email = newEvent.email;
            const userEmail = req.token_email;
            if (email !== userEmail) {
                return res.status(403).send({ message: "Forbidden" });
            }
            if (newEvent.eventDate) {
                newEvent.eventDate = new Date(newEvent.eventDate);
            }
            const result = await events.insertOne(newEvent);
            res.send(result);
        });

        app.patch("/events/:id", async (req, res) => {
            const id = req.params.id;
            const updatedEvent = req.body;
            const filter = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    eventTitle: updatedEvent.eventTitle,
                    eventDescription: updatedEvent.eventDescription,
                    eventType: updatedEvent.eventType,
                    eventImageUrl: updatedEvent.eventImageUrl,
                    eventLocation: updatedEvent.eventLocation,
                    eventDate: new Date(updatedEvent.eventDate),
                    eventStartTime: updatedEvent.eventStartTime,
                    eventEndTime: updatedEvent.eventEndTime,
                    email: updatedEvent.email,
                },
            };
            const result = await events.updateOne(filter, update);
            res.send(result);
        });

        app.get("/event/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await events.findOne(query);
            res.send(result);
        });

        app.get("/upcoming-events", async (req, res) => {
            const now = new Date();
            const today = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate()
            );
            const result = await events
                .find({ eventDate: { $gte: today } })
                .sort({ eventDate: 1 })
                .toArray();
            res.send(result);
        });

        // Joined Event API
        app.get("/joined-event", verifyFirebaseToken, async (req, res) => {
            const email = req.query.email;
            const userEmail = req.token_email;

            if (email !== userEmail) {
                return res.status(403).send({ message: "Forbidden" });
            }

            try {
                const result = await joinedEvent
                    .aggregate([
                        {
                            $match: { user_email: email },
                        },
                        {
                            $addFields: {
                                eventObjectId: { $toObjectId: "$eventId" },
                            },
                        },
                        {
                            $lookup: {
                                from: "events",
                                localField: "eventObjectId",
                                foreignField: "_id",
                                as: "eventDetails",
                            },
                        },
                        {
                            $unwind: "$eventDetails",
                        },
                        {
                            $sort: { "eventDetails.eventDate": 1 },
                        },
                        {
                            $project: {
                                _id: 1,
                                user_email: 1,
                                event: "$eventDetails",
                            },
                        },
                    ])
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Error fetching joined events",
                });
            }
        });

        app.post("/joined-event", async (req, res) => {
            const newJoinedEvent = req.body;
            const result = await joinedEvent.insertOne(newJoinedEvent);
            res.send(result);
        });

        app.get("/joined-event/:id", async (req, res) => {
            const id = req.params.id;
            const query = { eventId: id };
            const cursor = joinedEvent.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get("/search", async (req, res) => {
            const query = req.query.eventTitle;
            const categories = req.query.eventType;

            const now = new Date();
            const today = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate()
            );

            const filter = {
                eventDate: { $gt: today },
            };

            if (query) {
                filter.eventTitle = { $regex: query, $options: "i" };
            }

            if (categories) {
                filter.eventType = { $regex: categories, $options: "i" };
            }

            const cursor = events.find(filter).sort({ eventDate: 1 });
            const result = await cursor.toArray();
            res.send(result);
        });

        // await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );
    } finally {
    }
};

run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Actify server is running successfully!");
});

app.listen(port, () => {
    console.log(`Actify server app listening on port ${port}`);
});
