
const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");
const crypto = require("crypto");

const app = express();
const client = new MongoClient("mongodb://127.0.0.1:27017");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

async function startServer() {
    await client.connect();

    console.log("MongoDB connected successfully!");

    const db = client.db("ArchitecturalFirm");
    const registrations = db.collection("registrations");

    // Display the home page
    app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    // Handle architectural client registration
    app.post("/server", async (req, res) => {
        try {
            console.log("Form submitted. Received fields:", Object.keys(req.body));

            const {
                name,
                password,
                mobile,
                email,
                projectType,
                plotArea,
                location,
                budget,
                requirements
            } = req.body;

            // Handle single or multiple checkbox selections
            const services = Array.isArray(req.body.services)
                ? req.body.services
                : req.body.services
                    ? [req.body.services]
                    : [];

            // Validate required fields
            const requiredFields = {
                "Client Name": name,
                "Password": password,
                "Mobile Number": mobile,
                "Email": email,
                "Project Type": projectType,
                "Plot Area": plotArea,
                "Project Location": location,
                "Estimated Budget": budget
            };

            const missingFields = Object.entries(requiredFields)
                .filter(([key, value]) =>
                    value === undefined || value === null || String(value).trim() === ""
                )
                .map(([key]) => key);

            if (services.length === 0) {
                missingFields.push("Architectural Services");
            }

            if (missingFields.length > 0) {
                return res.status(400).send(`
                    <h2>Incomplete Registration</h2>
                    <p>Please complete these fields:</p>
                    <ul>
                        ${missingFields.map(field => `<li>${field}</li>`).join("")}
                    </ul>
                    <a href="/">Go Back to Registration Form</a>
                `);
            }

            // Hash password before saving
            const salt = crypto.randomBytes(16).toString("hex");

            const passwordHash = crypto
                .scryptSync(password, salt, 64)
                .toString("hex");

            // Create client project document
            const project = {
                name: name.trim(),
                passwordHash,
                salt,
                mobile: mobile.trim(),
                email: email.trim(),
                projectType,
                plotArea: Number(plotArea),
                location: location.trim(),
                budget,
                services,
                requirements: requirements || "",
                submittedAt: new Date()
            };

            // Save registration in MongoDB
            await registrations.insertOne(project);

            console.log("Project enquiry saved successfully!");

            // Retrieve all registrations
            const users = await registrations.find().toArray();

            // Prevent HTML injection when displaying submitted data
            const escapeHTML = value =>
                String(value ?? "").replace(/[&<>"']/g, char => ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                })[char]);

            const rows = users.map(user => `
                <tr>
                    <td>${escapeHTML(user.name)}</td>
                    <td>${escapeHTML(user.email)}</td>
                    <td>${escapeHTML(user.mobile)}</td>
                    <td>${escapeHTML(user.projectType)}</td>
                    <td>${escapeHTML(user.plotArea)}</td>
                    <td>${escapeHTML(user.location)}</td>
                    <td>${escapeHTML(user.budget)}</td>
                    <td>${escapeHTML((user.services || []).join(", "))}</td>
                    <td>${escapeHTML(user.requirements)}</td>
                </tr>
            `).join("");

            // Display registration details
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Architectural Project Enquiries</title>

                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            background: #f4f5f7;
                            padding: 25px;
                        }

                        h2 {
                            color: #172d4d;
                        }

                        table {
                            width: 100%;
                            border-collapse: collapse;
                            background: white;
                        }

                        th, td {
                            border: 1px solid #ccc;
                            padding: 10px;
                            text-align: left;
                        }

                        th {
                            background: #172d4d;
                            color: white;
                        }

                        a {
                            display: inline-block;
                            margin-top: 20px;
                            color: #172d4d;
                        }
                    </style>
                </head>

                <body>
                    <h2>Karunya Architectural Firm</h2>
                    <h3>Client Project Enquiries</h3>

                    <p>
                        Project enquiry submitted and stored successfully in MongoDB.
                    </p>

                    <table>
                        <tr>
                            <th>Client Name</th>
                            <th>Email</th>
                            <th>Mobile</th>
                            <th>Project Type</th>
                            <th>Plot Area</th>
                            <th>Location</th>
                            <th>Budget</th>
                            <th>Services</th>
                            <th>Requirements</th>
                        </tr>

                        ${rows}
                    </table>

                    <a href="/">Back to Home</a>
                </body>
                </html>
            `);

        } catch (error) {
            console.error("Registration error:", error);
            res.status(500).send("Error saving project enquiry.");
        }
    });

    app.listen(5000, () => {
        console.log("Server running at http://localhost:5000");
    });
}

startServer().catch(error => {
    console.error("Server startup failed:", error);
});
