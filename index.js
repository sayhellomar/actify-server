const express = require("express");
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const uri =
    `mongodb+srv://${process.env.ACTIFY_DB_USER}:${process.env.ACTIFY_DB_PASSWORD}@cluster0.apxhxix.mongodb.net/?appName=Cluster0`;

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

        const database = client.db('actify');
        const users = database.collection('users');
        const events = database.collection('events');
        const joinedEvent = database.collection('joined_event');

        app.get('/users', async (req, res) => {
            const cursor = users.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await users.insertOne(user);
            res.send(result);
        })


        await client.db('admin').command({ping: 1});
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}

run().catch(console.dir);

// actify_db_user
// KJRUFyyxckN2JhxU



app.get("/", (req, res) => {
    res.send("Actify server is running successfully!");
});

app.listen(port, () => {
    console.log(`Actify server app listening on port ${port}`);
});
