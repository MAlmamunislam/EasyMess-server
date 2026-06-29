const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
dotenv.config();

const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
  console.log("Hello World!");
});

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // Get the database
    const db = client.db("easymess");
    const allmesses = db.collection("allmesses");
    const allmembers = db.collection("allmembers");

    // Generate random invite code
    function generateInviteCode() {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

      let code = "";

      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      return code;
    }

   
    // Create a new mess
    app.post("/api/createmess", async (req, res) => {
      try {
        const { messName, messImage, messLocation, createdBy } = req.body;

        // Validate request data
        if (!messName || !messImage || !messLocation || !createdBy) {
          return res.status(400).send({
            success: false,
            message: "Required fields missing",
          });
        }

        // Generate unique invite code
        let inviteCode;
        let alreadyExists = true;

        while (alreadyExists) {
          inviteCode = generateInviteCode();

          const found = await allmesses.findOne({
            inviteCode,
          });

          alreadyExists = !!found;
        }

        // Prepare mess data
        const newMess = {
          messName,

          messImage,

          messLocation,

          inviteCode,

          createdBy,

          createdAt: new Date(),
        };

        // Insert into database
        const result = await allmesses.insertOne(newMess);

        res.send({
          success: true,

          insertedId: result.insertedId,

          inviteCode,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: "Failed to create mess",
        });
      }
    });

// Create a new member
app.post("/api/createmember", async (req, res) => {
  try {

    const {
      name,
      email,
      image,
      number,
      status,
      role,
      userId,
      messId,
    } = req.body;


    // Validate required fields
    if (
      !name ||
      !email ||
      !image ||
      !role ||
      !userId
    ) {
      return res.status(400).send({
        success: false,
        message: "Required fields missing",
      });
    }


    // Check existing membership
    const existing =
      await allmembers.findOne({
        userId,
      });


    if (existing) {
      return res.status(409).send({
        success: false,
        message:
          "User already exists",
      });
    }


    // Prepare member data
    const newMember = {

      name,

      email,

      image,

      number:
        number || "",

      status:
        status || "active",

      role,

      userId,

      messId:
        messId || null,

      createdAt:
        new Date(),

    };


    // Insert member
    const result =
      await allmembers.insertOne(
        newMember
      );


    res.send({
      success: true,
      insertedId:
        result.insertedId,
    });

  }

  catch (error) {

    console.log(error);

    res.status(500).send({
      success: false,
      message:
        "Failed to create member",
    });

  }
});
app.get("/api/getmess", async (req, res) => {
  res.send("Hello Worldjhhgjh!");


})






    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
