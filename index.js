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
    // await client.connect();

    // Get the database
    const db = client.db("easymess");
    const allmesses = db.collection("allmesses");
    const allmembers = db.collection("allmembers");
    const joinRequestsCollection = db.collection("joinRequests");
    const Meals = db.collection("mealscollection");
    const Deposits = db.collection("deposits");
    const Bazaars = db.collection("bazaars");

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
        const { messName, messImage, messLocation, createdBy, creaotrName } =
          req.body;

        // Validate request data
        if (!messName || !messImage || !messLocation || !createdBy) {
          return res.status(400).send({
            success: false,
            message: "Required fields missing",
          });
        }
        const userId = createdBy;

        const alreadyMember = await allmembers.findOne({
          userId,
        });

        if (alreadyMember) {
          return res.status(409).send({
            success: false,
            message: "You are already a member of a mess.",
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

        // Prepare mess data creat manager
        const newMess = {
          messName,

          messImage,

          messLocation,

          inviteCode,
          creaotrName,

          createdBy,
          mealSettings: {
            breakfastWeight: 0.5,
            lunchWeight: 1,
            dinnerWeight: 1,
            breakfastDeadline: "07:00", // Format: HH:mm
            lunchDeadline: "12:00",
            dinnerDeadline: "20:00",
          },

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
        const { name, email, image, number, status, role, userId, messId } =
          req.body;

        // Validate required fields
        if (!name || !email || !image || !role || !userId) {
          return res.status(400).send({
            success: false,
            message: "Required fields missing",
          });
        }

        // Check existing membership
        const existing = await allmembers.findOne({
          userId,
        });

        if (existing) {
          return res.status(409).send({
            success: false,
            message: "User already exists",
          });
        }

        // Prepare member data
        const newMember = {
          name,

          email,

          image,

          number: number || "",

          status: status || "active",

          role,

          userId,

          messId: new ObjectId(messId),

          createdAt: new Date(),
        };

        // Insert member
        const result = await allmembers.insertOne(newMember);

        res.send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: "Failed to create member",
        });
      }
    });

    // get user role
    app.get("/api/member/role/:userId", async (req, res) => {
      const { userId } = req.params;
      const member = await allmembers.findOne({ userId: userId });
      if (member) {
        res.send({ role: member.role });
      } else {
        res.status(404).send({ role: null });
      }
    });
    // get  messId
    app.get("/api/member/messid/:userId", async (req, res) => {
      try {
        const { userId } = req.params;
        const member = await allmembers.findOne({ userId: userId });

        if (member) {
          res.send({
            messId: member.messId,
            createdAt: member.createdAt,
          });
        } else {
          res.status(404).send({ role: null });
        }
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // there have error in this code
    // GET: Fetch user details by userId
    app.get("/api/user-details/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        // Check if userId is valid ObjectId (if you use MongoDB)
        const query = { _id: new ObjectId(userId) };

        // Find the user in your users collection
        const user = await usersCollection.findOne(query);

        if (!user) {
          return res
            .status(404)
            .send({ success: false, message: "User not found" });
        }

        res.send({
          success: true,
          data: {
            name: user.name,
            email: user.email,
            image: user.image,
          },
        });
      } catch (error) {
        console.error("Error fetching user details:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    // Join Mess Request API
    app.post("/api/join-mess-request", async (req, res) => {
      try {
        const { userId, inviteCode, userName, userEmail, userImage } = req.body;

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

        const alreadyMember = await allmembers.findOne({
          userId,
        });

        if (alreadyMember) {
          return res.status(409).send({
            success: false,
            message: "You are already a member of a mess.",
          });
        }

        // chek if user already has a pending request
        const existingRequest = await joinRequestsCollection.findOne({
          userId: userId,
          messId: mess._id,
          status: "pending",
        });

        if (existingRequest) {
          console.log(existingRequest);
          return res.status(409).send({
            success: false,
            message: "Request already pending please wait for approval",
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
    const { ObjectId } = require("mongodb");

    app.get("/api/mess/pending-requests/:messId", async (req, res) => {
      try {
        const { messId } = req.params;

        // Convert the string messId to MongoDB ObjectId
        const query = {
          messId: new ObjectId(messId),
          status: "pending",
        };

        const pendingRequests = await joinRequestsCollection
          .find(query)
          .toArray();

        res.send({
          success: true,
          data: pendingRequests,
        });
      } catch (error) {
        console.error("Error fetching pending requests:", error);
        res.status(500).send({
          success: false,
          message: "Invalid ID format or Database error",
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
          createdBy: managerId, // তোমার কোডে createdBy দিয়ে ম্যানেজার ট্র্যাক করছো
        });

        if (!isOwner) {
          return res
            .status(403)
            .send({ success: false, message: "Unauthorized: Access denied!" });
        }

        // ২. রিকোয়েস্টটি ডিলিট করা (Approve বা Reject উভয় ক্ষেত্রেই)
        const deleteResult = await joinRequestsCollection.deleteOne({
          _id: new ObjectId(requestId),
          messId: new ObjectId(messId), // অতিরিক্ত সিকিউরিটি: মেস আইডি চেক
        });

        if (deleteResult.deletedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Request not found" });
        }

        // ৩. যদি অ্যাকশন 'approve' হয়
        if (action === "approve") {
          // চেক করো ইউজার অলরেডি মেম্বার কি না
          const alreadyMember = await allmembers.findOne({
            userId: userData.userId,
          });

          if (alreadyMember) {
            return res
              .status(409)
              .send({ success: false, message: "User is already a member!" });
          }

          // add as a member
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
          return res.send({
            success: true,
            message: "Member approved successfully!",
          });
        }

        // if action is reject
        res.send({ success: true, message: "Request rejected successfully." });
      } catch (error) {
        console.error("Error handling request:", error);
        res.status(500).send({ success: false, message: "Server Error" });
      }
    });

    // meal settings

    app.patch("/api/meal/update", async (req, res) => {
      try {
        const { userId, messId, date, mealType, status } = req.body;

        const isMember = await allmembers.findOne({
          userId,
          messId: new ObjectId(messId),
        });

        if (!isMember) {
          return res.status(403).send({
            success: false,
            message: "Unauthorized: You are not a member of this mess!",
          });
        }

        // ২. মেসের ডেডলাইন সেটিংস নিয়ে আসা
        const mess = await allmesses.findOne({ _id: new ObjectId(messId) });
        if (!mess)
          return res
            .status(404)
            .send({ success: false, message: "Mess not found!" });

        const deadline = mess.mealSettings[`${mealType}Deadline`];

        // ৩. বর্তমান সময়ের সাথে ডেডলাইন চেক
        const now = new Date();
        const mealDate = new Date(date);

        // ডেট নরমাল করা (ঘণ্টা-মিনিট বাদ দিয়ে শুধু তারিখ)
        mealDate.setUTCHours(0, 0, 0, 0);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        if (mealDate.getTime() === today.getTime()) {
          const [hours, minutes] = deadline.split(":");
          const deadLineDate = new Date();
          deadLineDate.setHours(hours, minutes, 0, 0);
          if (now > deadLineDate) {
            return res
              .status(403)
              .send({ success: false, message: "Deadline passed!" });
          }
        } else if (mealDate < today) {
          return res
            .status(403)
            .send({ success: false, message: "Cannot edit past meals!" });
        }

        // ৪. Meal আপডেট করা
        const updateField = { [mealType]: status };
        await Meals.updateOne(
          { userId, date: mealDate },
          { $set: updateField },
          { upsert: true },
        );

        res.send({ success: true, message: "Meal updated successfully" });
      } catch (error) {
        console.error("Update Error:", error);
        res.status(500).send({ success: false, message: "Failed to update" });
      }
    });

    // make monthly report
    app.get("/api/meal/report", async (req, res) => {
      try {
        const { userId, month, year } = req.query;

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const meals = await Meals.find({
          userId,
          date: { $gte: startDate, $lte: endDate },
        }).toArray();

        const total = meals.reduce(
          (acc, curr) => {
            if (curr.breakfast) acc.breakfast += 1;
            if (curr.lunch) acc.lunch += 1;
            if (curr.dinner) acc.dinner += 1;
            return acc;
          },
          { breakfast: 0, lunch: 0, dinner: 0 },
        );

        res.send({ meals, total });
      } catch (error) {
        res.status(500).send({ success: false, message: "Server Error" });
      }
    });

    // manager meal management
    app.patch("/api/manager/update-meal", async (req, res) => {
      try {
        const {
          managerId,
          userId,
          date,
          breakfast,
          lunch,
          dinner,
          guestBreakfast,
          guestLunch,
          guestDinner,
        } = req.body;

        // ১. ম্যানেজার ভেরিফিকেশন
        const manager = await allmembers.findOne({
          userId: managerId,
          role: "manager",
        });
        if (!manager) {
          return res
            .status(403)
            .send({
              success: false,
              message: "Unauthorized: Only managers can update",
            });
        }

        // ২. মিল আপডেট (ম্যানেজার শুধু তার মেসের মেম্বারদের আপডেট করতে পারবে)
        const targetMember = await allmembers.findOne({
          userId: userId,
          messId: manager.messId,
        });
        if (!targetMember) {
          return res
            .status(403)
            .send({
              success: false,
              message: "Cannot edit member outside your mess",
            });
        }

        const mealDate = new Date(date);
        mealDate.setUTCHours(0, 0, 0, 0);

        await Meals.updateOne(
          { userId, date: mealDate },
          {
            $set: {
              breakfast,
              lunch,
              dinner,
              guestBreakfast: guestBreakfast || 0,
              guestLunch: guestLunch || 0,
              guestDinner: guestDinner || 0,
            },
          },
          { upsert: true },
        );

        res.send({ success: true, message: "Update Successful" });
      } catch (error) {
        res.status(500).send({ success: false, message: "Update Failed" });
      }
    });

    app.get("/api/manager/meals", async (req, res) => {
      try {
        const { userId, date } = req.query;

        // ১. ইউজারটি ম্যানেজার কি না চেক করো
        const manager = await allmembers.findOne({
          userId: userId,
          role: "manager",
        });
        if (!manager) {
          return res
            .status(403)
            .send({ success: false, message: "Unauthorized" });
        }

        const members = await allmembers
          .find({ messId: manager.messId })
          .toArray();

        const mealDate = new Date(date);
        mealDate.setUTCHours(0, 0, 0, 0);
        const mealRecords = await Meals.find({ date: mealDate }).toArray();

        // ৩. if thare have no meal record for a member, we will assume they didn't take any meal
        const result = members.map((member) => {
          const record =
            mealRecords.find((m) => m.userId === member.userId) || {};
          return {
            userId: member.userId,
            name: member.name,
            breakfast: record.breakfast !== false,
            lunch: record.lunch !== false,
            dinner: record.dinner !== false,
            guestBreakfast: record.guestBreakfast || 0,
            guestLunch: record.guestLunch || 0,
            guestDinner: record.guestDinner || 0,
            createdAt: member.createdAt,
          };
        });

        // ৪.samary
        const summary = result.reduce(
          (acc, curr) => {
            if (curr.breakfast) acc.breakfast += 1;
            if (curr.lunch) acc.lunch += 1;
            if (curr.dinner) acc.dinner += 1;
            acc.guestMeal +=
              curr.guestBreakfast + curr.guestLunch + curr.guestDinner;
            return acc;
          },
          { breakfast: 0, lunch: 0, dinner: 0, guestMeal: 0 },
        );

        res.send({ success: true, summary, members: result });
      } catch (error) {
        res.status(500).send({ success: false, message: "Server Error" });
      }
    });

    //  DEPOSIT / PAYMENT MANAGEMENT

    // ১. Manager নতুন Deposit Add করবে
    app.post("/api/deposits", async (req, res) => {
      try {
        const { managerId, userId, amount, paymentMethod, note, date } =
          req.body;

        // Validation
        if (!managerId || !userId || !amount || !paymentMethod || !date) {
          return res.status(400).send({
            success: false,
            message: "managerId, userId, amount, paymentMethod, date আবশ্যক",
          });
        }

        if (parseFloat(amount) <= 0) {
          return res.status(400).send({
            success: false,
            message: "Amount must be greater than 0",
          });
        }

        const validMethods = ["Cash", "bKash", "Nagad", "Bank"];
        if (!validMethods.includes(paymentMethod)) {
          return res.status(400).send({
            success: false,
            message:
              "paymentMethod must be one of Cash, bKash, Nagad, or Bank",
          });
        }

        // Manager verify করা
        const manager = await allmembers.findOne({
          userId: managerId,
          role: "manager",
        });
        if (!manager) {
          return res
            .status(403)
            .send({
              success: false,
              message: "Unauthorized: Only managers can add deposits",
            });
        }

        // টাকা যে মেম্বার দিয়েছে সে এই ম্যানেজারের মেসেরই কি না চেক করা
        const targetMember = await allmembers.findOne({
          userId,
          messId: manager.messId,
        });
        if (!targetMember) {
          return res
            .status(403)
            .send({
              success: false,
              message: "This member is not in your mess",
            });
        }

        const newDeposit = {
          messId: manager.messId,
          userId,
          amount: parseFloat(amount),
          paymentMethod,
          note: note || "",
          receivedBy: managerId,
          date: new Date(date),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await Deposits.insertOne(newDeposit);

        res.send({
          success: true,
          message: "Deposit added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Add Deposit Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to add deposit" });
      }
    });

    // ২. User নিজের Deposit History + Total দেখবে
    app.get("/api/deposits/user/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        const history = await Deposits.find({ userId })
          .sort({ date: -1 })
          .toArray();

        const total = history.reduce((sum, d) => sum + d.amount, 0);

        res.send({
          success: true,
          total,
          count: history.length,
          data: history,
        });
      } catch (error) {
        console.error("Get User Deposits Error:", error);
        res.status(500).send({ success: false, message: "Server Error" });
      }
    });

    // ৩. Manager সব মেম্বারের Deposit দেখবে (Search + Month Filter সহ)
    // Usage: /api/manager/deposits?managerId=xxx&month=2026-07&search=Rahim
    app.get("/api/manager/deposits", async (req, res) => {
      try {
        const { managerId, month, search } = req.query;

        if (!managerId) {
          return res
            .status(400)
            .send({ success: false, message: "managerId is required" });
        }

        const manager = await allmembers.findOne({
          userId: managerId,
          role: "manager",
        });
        if (!manager) {
          return res
            .status(403)
            .send({ success: false, message: "Unauthorized" });
        }

        // Member filter (name দিয়ে search)
        const memberMatch = { messId: manager.messId };
        if (search) {
          memberMatch.name = { $regex: search, $options: "i" };
        }

        // Month filter (format: 2026-07)
        let dateFilter = null;
        if (month) {
          const [year, monthNum] = month.split("-").map(Number);
          if (!year || !monthNum) {
            return res
              .status(400)
              .send({
                success: false,
                message: "month format must be YYYY-MM",
              });
          }
          const startDate = new Date(year, monthNum - 1, 1);
          const endDate = new Date(year, monthNum, 1);
          dateFilter = { $gte: startDate, $lt: endDate };
        }

        const summary = await allmembers
          .aggregate([
            { $match: memberMatch },
            {
              $lookup: {
                from: "deposits",
                let: { uid: "$userId" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$userId", "$$uid"] },
                      ...(dateFilter ? { date: dateFilter } : {}),
                    },
                  },
                  { $sort: { date: -1 } },
                ],
                as: "history",
              },
            },
            {
              $project: {
                name: 1,
                image: 1,
                userId: 1,
                history: 1,
                total: { $sum: "$history.amount" },
              },
            },
          ])
          .toArray();

        const grandTotal = summary.reduce((sum, m) => sum + m.total, 0);

        res.send({ success: true, grandTotal, data: summary });
      } catch (error) {
        console.error("Get Manager Deposits Error:", error);
        res.status(500).send({ success: false, message: "Server Error" });
      }
    });

    // ৪. Manager Deposit Edit করবে
    app.patch("/api/deposits/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { managerId, amount, paymentMethod, note, date } = req.body;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid deposit ID" });
        }

        const manager = await allmembers.findOne({
          userId: managerId,
          role: "manager",
        });
        if (!manager) {
          return res
            .status(403)
            .send({ success: false, message: "Unauthorized" });
        }

        const updateData = { updatedAt: new Date() };
        if (amount !== undefined) {
          if (parseFloat(amount) <= 0) {
            return res
              .status(400)
              .send({
                success: false,
                message: "Amount must be greater than 0",
              });
          }
          updateData.amount = parseFloat(amount);
        }
        if (paymentMethod !== undefined)
          updateData.paymentMethod = paymentMethod;
        if (note !== undefined) updateData.note = note;
        if (date !== undefined) updateData.date = new Date(date);

        const result = await Deposits.updateOne(
          { _id: new ObjectId(id), messId: manager.messId }, // নিজের মেসের বাইরে edit করতে পারবে না
          { $set: updateData },
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Deposit not found" });
        }

        res.send({ success: true, message: "Deposit updated successfully" });
      } catch (error) {
        console.error("Update Deposit Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to update deposit" });
      }
    });

    // ৫. Manager Deposit Delete করবে
    app.delete("/api/deposits/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { managerId } = req.body;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid deposit ID" });
        }

        const manager = await allmembers.findOne({
          userId: managerId,
          role: "manager",
        });
        if (!manager) {
          return res
            .status(403)
            .send({ success: false, message: "Unauthorized" });
        }

        const result = await Deposits.deleteOne({
          _id: new ObjectId(id),
          messId: manager.messId,
        });

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Deposit not found" });
        }

        res.send({ success: true, message: "Deposit deleted successfully" });
      } catch (error) {
        console.error("Delete Deposit Error:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to delete deposit" });
      }
    });







    // bazar management 


// 🛒 BAZAAR MANAGEMENT


// Helper: only Manager can access, and only for their own mess
async function getVerifiedManager(managerId) {
  return await allmembers.findOne({ userId: managerId, role: "manager" });
}

// 1. Create a new Bazaar entry
app.post("/api/bazaars", async (req, res) => {
  try {
    const { managerId, date, note, items } = req.body;

    if (!managerId || !date || !Array.isArray(items) || items.length === 0) {
      return res.status(400).send({
        success: false,
        message: "managerId, date and at least one item are required",
      });
    }

    const manager = await getVerifiedManager(managerId);
    if (!manager) {
      return res.status(403).send({ success: false, message: "Unauthorized: Only managers can add bazaar" });
    }

    // Clean items: drop empty rows, force amount to a number
    const cleanItems = items
      .filter((item) => item.title && item.title.trim() !== "")
      .map((item) => ({
        title: item.title.trim(),
        amount: parseFloat(item.amount) || 0,
      }));

    if (cleanItems.length === 0) {
      return res.status(400).send({ success: false, message: "Add at least one valid item" });
    }

    const hasInvalidAmount = cleanItems.some((item) => item.amount <= 0);
    if (hasInvalidAmount) {
      return res.status(400).send({ success: false, message: "Item amount must be greater than 0" });
    }

    const totalAmount = cleanItems.reduce((sum, item) => sum + item.amount, 0);
    const bazaarDate = new Date(date);

    const newBazaar = {
      messId: manager.messId,
      date: bazaarDate,
      items: cleanItems,
      totalAmount,
      note: note || "",
      createdBy: managerId,
      month: bazaarDate.getMonth() + 1,
      year: bazaarDate.getFullYear(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await Bazaars.insertOne(newBazaar);

    res.send({
      success: true,
      message: "Bazaar added successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Add Bazaar Error:", error);
    res.status(500).send({ success: false, message: "Failed to add bazaar" });
  }
});

// 2. Get Bazaar history for a mess (Month/Year filter supported)
// Usage: /api/bazaars?managerId=xxx&month=7&year=2026
app.get("/api/bazaars", async (req, res) => {
  try {
    const { managerId, month, year } = req.query;

    if (!managerId) {
      return res.status(400).send({ success: false, message: "managerId is required" });
    }

    const manager = await getVerifiedManager(managerId);
    if (!manager) {
      return res.status(403).send({ success: false, message: "Unauthorized" });
    }

    const filter = { messId: manager.messId };
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);

    const bazaars = await Bazaars.find(filter).sort({ date: -1 }).toArray();

    const grandTotal = bazaars.reduce((sum, b) => sum + b.totalAmount, 0);

    res.send({ success: true, grandTotal, data: bazaars });
  } catch (error) {
    console.error("Get Bazaars Error:", error);
    res.status(500).send({ success: false, message: "Server Error" });
  }
});

// 3. Update a Bazaar entry
app.patch("/api/bazaars/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { managerId, date, note, items } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ success: false, message: "Invalid bazaar ID" });
    }

    const manager = await getVerifiedManager(managerId);
    if (!manager) {
      return res.status(403).send({ success: false, message: "Unauthorized" });
    }

    const updateData = { updatedAt: new Date() };

    if (Array.isArray(items)) {
      const cleanItems = items
        .filter((item) => item.title && item.title.trim() !== "")
        .map((item) => ({
          title: item.title.trim(),
          amount: parseFloat(item.amount) || 0,
        }));

      if (cleanItems.length === 0) {
        return res.status(400).send({ success: false, message: "Add at least one valid item" });
      }
      const hasInvalidAmount = cleanItems.some((item) => item.amount <= 0);
      if (hasInvalidAmount) {
        return res.status(400).send({ success: false, message: "Item amount must be greater than 0" });
      }

      updateData.items = cleanItems;
      updateData.totalAmount = cleanItems.reduce((sum, item) => sum + item.amount, 0);
    }

    if (date !== undefined) {
      const bazaarDate = new Date(date);
      updateData.date = bazaarDate;
      updateData.month = bazaarDate.getMonth() + 1;
      updateData.year = bazaarDate.getFullYear();
    }

    if (note !== undefined) updateData.note = note;

    const result = await Bazaars.updateOne(
      { _id: new ObjectId(id), messId: manager.messId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ success: false, message: "Bazaar not found" });
    }

    res.send({ success: true, message: "Bazaar updated successfully" });
  } catch (error) {
    console.error("Update Bazaar Error:", error);
    res.status(500).send({ success: false, message: "Failed to update bazaar" });
  }
});

// 4. Delete a Bazaar entry
app.delete("/api/bazaars/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ success: false, message: "Invalid bazaar ID" });
    }

    const manager = await getVerifiedManager(managerId);
    if (!manager) {
      return res.status(403).send({ success: false, message: "Unauthorized" });
    }

    const result = await Bazaars.deleteOne({
      _id: new ObjectId(id),
      messId: manager.messId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({ success: false, message: "Bazaar not found" });
    }

    res.send({ success: true, message: "Bazaar deleted successfully" });
  } catch (error) {
    console.error("Delete Bazaar Error:", error);
    res.status(500).send({ success: false, message: "Failed to delete bazaar" });
  }
});




// 5. Member: Get Bazaar history of their own mess (view only)
// Usage: /api/bazaars/user/:userId?month=7&year=2026
app.get("/api/bazaars/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    // ইউজার কোনো মেসের member কি না চেক করা
    const member = await allmembers.findOne({ userId });
    if (!member) {
      return res
        .status(403)
        .send({ success: false, message: "Unauthorized: You are not a member of any mess!" });
    }

    const filter = { messId: member.messId };
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);

    const bazaars = await Bazaars.find(filter).sort({ date: -1 }).toArray();
    const grandTotal = bazaars.reduce((sum, b) => sum + b.totalAmount, 0);

    res.send({ success: true, grandTotal, data: bazaars });
  } catch (error) {
    console.error("Get User Bazaars Error:", error);
    res.status(500).send({ success: false, message: "Server Error" });
  }
});





// sumary of all expenses for a mess

// ============================================================
// 📊 MONTHLY OVERVIEW & REPORT MODULE
// ============================================================
// এই কোডটুকু তোমার existing index.js এর run() ফাংশনের ভিতরে,
// অন্য app.get/app.post গুলোর পাশে বসিয়ে দাও।
// এটা তোমার allmesses, allmembers, Meals, Deposits, Bazaars
// collection গুলো ব্যবহার করে (উপরে run() এর ভিতরে যেভাবে define করা আছে)।
// ============================================================

// GET: Monthly Overview (User + Manager উভয়ই access করতে পারবে)
// Usage: /api/overview?userId=xxx&month=7&year=2026
app.get("/api/overview", async (req, res) => {
  try {
    const { userId, month, year } = req.query;

    if (!userId || !month || !year) {
      return res.status(400).send({
        success: false,
        message: "userId, month, year আবশ্যক",
      });
    }

    // ১. Requester কোন মেসের member তা বের করা (User বা Manager দুজনই এখানে আসতে পারবে)
    const requester = await allmembers.findOne({ userId });
    if (!requester) {
      return res.status(403).send({
        success: false,
        message: "Unauthorized: You are not a member of any mess!",
      });
    }

    const messId = requester.messId;

    // ২. Mess খুঁজে বের করা (মিল ওয়েট, নাম ইত্যাদির জন্য)
    const mess = await allmesses.findOne({ _id: messId });
    if (!mess) {
      return res.status(404).send({ success: false, message: "Mess not found" });
    }

    const weights = mess.mealSettings || {
      breakfastWeight: 0.5,
      lunchWeight: 1,
      dinnerWeight: 1,
    };

    // ৩. এই মেসের সব member নিয়ে আসা
    const members = await allmembers.find({ messId }).toArray();
    const memberUserIds = members.map((m) => m.userId);

    // ৪. Selected Month এর Date Range বানানো
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 1); // পরের মাসের ১ তারিখ (exclusive)

    // ৫. এই মাসের সব Meal record আনা (এই মেসের সব member এর জন্য)
    const meals = await Meals.find({
      userId: { $in: memberUserIds },
      date: { $gte: startDate, $lt: endDate },
    }).toArray();

    // ৬. এই মাসের সব Deposit আনা
    const deposits = await Deposits.find({
      messId,
      date: { $gte: startDate, $lt: endDate },
    }).toArray();

    // ৭. এই মাসের সব Bazaar আনা (bazaar এ আগে থেকেই month/year field আছে)
    const bazaars = await Bazaars.find({
      messId,
      month: monthNum,
      year: yearNum,
    }).toArray();

    // ৮. Total Bazaar বের করা
    const totalBazaar = bazaars.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    // ৯. প্রতিটা member এর জন্য weighted meal count বের করা (নিজের meal + guest meal)
    function calcWeightedMeal(record) {
      if (!record) return 0;
      const own =
        (record.breakfast !== false ? weights.breakfastWeight : 0) +
        (record.lunch !== false ? weights.lunchWeight : 0) +
        (record.dinner !== false ? weights.dinnerWeight : 0);
      const guest =
        (record.guestBreakfast || 0) * weights.breakfastWeight +
        (record.guestLunch || 0) * weights.lunchWeight +
        (record.guestDinner || 0) * weights.dinnerWeight;
      return own + guest;
    }

    // member wise data তৈরি করা
    const memberData = members.map((member) => {
      const memberMeals = meals.filter((m) => m.userId === member.userId);
      const totalMeal = memberMeals.reduce(
        (sum, record) => sum + calcWeightedMeal(record),
        0
      );

      const memberDeposits = deposits.filter((d) => d.userId === member.userId);
      const deposit = memberDeposits.reduce((sum, d) => sum + (d.amount || 0), 0);

      return {
        userId: member.userId,
        userName: member.name,
        totalMeal: Number(totalMeal.toFixed(2)),
        deposit,
      };
    });

    // ১০. Total Meal (পুরো মেসের) এবং Meal Rate বের করা
    const totalMeal = memberData.reduce((sum, m) => sum + m.totalMeal, 0);
    const mealRate = totalMeal > 0 ? totalBazaar / totalMeal : 0;

    // ১১. Total Deposit বের করা
    const totalDeposit = memberData.reduce((sum, m) => sum + m.deposit, 0);

    // ১২. প্রতিটা member এর Bill, Balance, Status বের করা
    const finalMembers = memberData.map((m) => {
      const bill = Number((m.totalMeal * mealRate).toFixed(2));
      const balance = Number((m.deposit - bill).toFixed(2));

      return {
        userId: m.userId,
        userName: m.userName,
        totalMeal: m.totalMeal,
        deposit: m.deposit,
        bill,
        balance,
        status: balance >= 0 ? "advance" : "due",
      };
    });

    // ১৩. Response পাঠানো (Doc এর Response Format অনুযায়ী)
    res.send({
      success: true,
      messName: mess.messName,
      month: monthNum,
      year: yearNum,
      requesterRole: requester.role, // frontend এটা দিয়ে বুঝবে manager না user
      summary: {
        totalDeposit,
        totalBazaar,
        totalMeal: Number(totalMeal.toFixed(2)),
        mealRate: Number(mealRate.toFixed(2)),
      },
      members: finalMembers,
    });
  } catch (error) {
    console.error("Overview Error:", error);
    res.status(500).send({ success: false, message: "Failed to load overview" });
  }
});









    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
