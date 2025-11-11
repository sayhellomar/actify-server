const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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
        await client.connect();

        const database = client.db("actify");
        const users = database.collection("users");
        const events = database.collection("events");
        const joinedEvent = database.collection("joined_event");

        app.get("/users", async (req, res) => {
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
            const query = { email: email };
            const existingUser = await users.findOne(query);
            if (existingUser) {
                res.send({ message: "User is already exists" });
            } else {
                const result = await users.insertOne(user);
                res.send(result);
            }
        });

        app.get('/event/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await events.findOne(query);
            res.send(result);
        })

        app.get("/upcoming-events", async (req, res) => {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const result = await events.find({eventDate: {$gte: today}}).sort({eventDate: 1}).toArray();
            res.send(result);
        });

        app.get('/events', async (req, res) => {
            const email = req.query.email;
            const query = {};
            if(email) {
                query.email = email;
            }
            const cursor = events.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.post("/events", async (req, res) => {
            const newEvent = req.body;
            if(newEvent.eventDate) {
                newEvent.eventDate = new Date(newEvent.eventDate);
            }
            const result = await events.insertOne(newEvent);
            res.send(result);
        });

        app.get('/joined-event', async (req, res) => {
            const email = req.query.email;

            try {
                const result = await joinedEvent.aggregate([
                    {
                        $match: {user_email: email}
                    },
                    {
                        $addFields: {
                            eventObjectId: {$toObjectId: '$eventId'}
                        }
                    },
                    {
                        $lookup: {
                            from: 'events',
                            localField: 'eventObjectId',
                            foreignField: '_id',
                            as: 'eventDetails'
                        }
                    },
                    {
                        $unwind: '$eventDetails'
                    },
                    {
                        $project: {
                            _id: 1,
                            user_email: 1,
                            event: '$eventDetails'
                        }
                    }
                ]).toArray();

                res.send(result);
            } catch(error) {
                res.status(500).send({message: 'Error fetching joined events'})
            }
        });

        app.post('/joined-event', async (req, res) => {
            const newJoinedEvent = req.body;
            const result = await joinedEvent.insertOne(newJoinedEvent);
            res.send(result);
        });

        app.get('/joined-event/:id', async (req, res) => {
            const id = req.params.id;
            const query = {eventId: id}
            const cursor = joinedEvent.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        await client.db("admin").command({ ping: 1 });
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
