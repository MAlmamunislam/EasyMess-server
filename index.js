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
    const joinRequestsCollection = db.collection("joinRequests");

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

// get user role 
app.get("/api/member/role/:userId", async (req, res) => {
  const {userId} = req.params;
  const member = await allmembers.findOne({userId: userId});
  if (member) {
    res.send({ role: member.role }); 
  } else {
    res.status(404).send({ role: null });
  }
})
// get user messId  
app.get("/api/member/messid/:userId", async (req, res) => {
  const {userId} = req.params;
  const member = await allmembers.findOne({userId: userId});
  if (member) {
    res.send({ messId: member.messId });
  } else {
    res.status(404).send({ role: null });
  }
})


// GET: Fetch user details by userId
app.get("/api/user-details/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if userId is valid ObjectId (if you use MongoDB)
    const query = { _id: new ObjectId(userId) }; 
    
    // Find the user in your users collection
    const user = await usersCollection.findOne(query);

    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    res.send({ 
      success: true, 
      data: {
        name: user.name,
        email: user.email,
        image: user.image
      } 
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).send({ success: false, message: "Internal server error" });
  }
});







// Join Mess Request API
app.post("/api/join-mess-request", async (req, res) => {
  try {
    const { userId, inviteCode ,userName, userEmail, userImage } = req.body;

    // ১. Validation
    if (!userId || !inviteCode) {
      return res.status(400).send({
        success: false,
        message: "Required fields missing (userId or inviteCode)",
      });
    }

    // ২. Mess find
    const mess = await allmesses.findOne({ inviteCode: inviteCode });
    if (!mess) {
      return res.status(404).send({
        success: false,
        message: "Invalid Invite Code",
      });
    }

    // chek if user already has a pending request
    const existingRequest = await joinRequestsCollection.findOne({
      userId: userId,
      messId: mess._id,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(409).send({
        success: false,
        message: "Request already pending",
      });
    }

    // ৪.insert request
    const newRequest = {
      userId: userId,
      messId: mess._id,
      status: "pending",
      userName: userName,
      userEmail: userEmail,
      userImage: userImage,
      createdAt: new Date(),
    };

    const result = await joinRequestsCollection.insertOne(newRequest);

    res.send({
      success: true,
      message: "Request sent successfully",
      insertedId: result.insertedId,
    });

  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Failed to send join request",
    });
  }
});

// GET: Fetch all pending requests for a specific mess
// Import ObjectId at the top of your file
const { ObjectId } = require('mongodb');

app.get("/api/mess/pending-requests/:messId", async (req, res) => {
  try {
    const { messId } = req.params;
    
    // Convert the string messId to MongoDB ObjectId
    const query = {
      messId: new ObjectId(messId),  
      status: "pending"
    };

    const pendingRequests = await joinRequestsCollection.find(query).toArray();

    res.send({ 
      success: true, 
      data: pendingRequests 
    });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    res.status(500).send({ 
      success: false, 
      message: "Invalid ID format or Database error" 
    });
  }
});


// POST: Handle join request (Approve or Reject)
// POST: Handle join request (Approve or Reject)
app.post("/api/mess/handle-request", async (req, res) => {
  try {
    const { requestId, action, userData, messId, managerId } = req.body;

    // ১. Ownership Validation: ম্যানেজার কি আসলেই এই মেসের ম্যানেজার?
    // তোমার allmesses কালেকশনে managerId ফিল্ড আছে কি না চেক করে নিও
    const isOwner = await allmesses.findOne({ 
      _id: new ObjectId(messId), 
      createdBy: managerId // তোমার কোডে createdBy দিয়ে ম্যানেজার ট্র্যাক করছো
    });

    if (!isOwner) {
      return res.status(403).send({ success: false, message: "Unauthorized: Access denied!" });
    }

    // ২. রিকোয়েস্টটি ডিলিট করা (Approve বা Reject উভয় ক্ষেত্রেই)
    const deleteResult = await joinRequestsCollection.deleteOne({ 
      _id: new ObjectId(requestId),
      messId: new ObjectId(messId) // অতিরিক্ত সিকিউরিটি: মেস আইডি চেক
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).send({ success: false, message: "Request not found" });
    }

    // ৩. যদি অ্যাকশন 'approve' হয়
    if (action === "approve") {
      // চেক করো ইউজার অলরেডি মেম্বার কি না
      const alreadyMember = await allmembers.findOne({ userId: userData.userId });
      
      if (alreadyMember) {
        return res.status(409).send({ success: false, message: "User is already a member!" });
      }

      // মেম্বার হিসেবে অ্যাড করা
      const newMember = {
        name: userData.userName,
        email: userData.userEmail,
        image: userData.userImage,
        userId: userData.userId,
        messId: new ObjectId(messId),
        role: "member",
        status: "active",
        createdAt: new Date(),
      };
      
      await allmembers.insertOne(newMember);
      return res.send({ success: true, message: "Member approved successfully!" });
    }

    // যদি অ্যাকশন 'reject' হয়
    res.send({ success: true, message: "Request rejected successfully." });

  } catch (error) {
    console.error("Error handling request:", error);
    res.status(500).send({ success: false, message: "Server Error" });
  }
});









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
