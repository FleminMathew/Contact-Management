// Import necessary modules
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

// --- INITIALIZE EXPRESS APP ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse incoming JSON requests
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the 'public' directory

// --- DATABASE CONNECTION ---
// Added { family: 4 } to force IPv4, which can resolve connection issues with some network configurations
mongoose.connect(process.env.MONGO_URI, { family: 4 })
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1); // Exit process with failure
  });

// --- MONGOOSE SCHEMA AND MODEL ---
const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required."],
    trim: true
  },
  email: {
    type: String,
    required: [true, "Email is required."],
    trim: true,
    lowercase: true,
    match: [/.+\@.+\..+/, "Please enter a valid email address."]
  },
  phone: {
    type: String,
    required: [true, "Phone number is required."],
    trim: true,
    unique: true, // Enforce uniqueness at the database level
    validate: {
      validator: function(v) {
        // Regular expression to test for exactly 10 digits
        return /^\d{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid 10-digit phone number!`
    }
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

const Contact = mongoose.model('Contact', contactSchema);

// --- API ROUTES ---

// GET: Retrieve all contacts, with optional search
app.get('/api/contacts', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      const searchRegex = new RegExp(search, 'i'); // Case-insensitive regex
      query = { name: searchRegex };
    }
    
    // --- MODIFIED SORT LOGIC ---
    // Added collation to make the sort case-insensitive.
    // 'locale: en' specifies English language rules.
    // 'strength: 2' is the key part: it compares strings ignoring case.
    const contacts = await Contact.find(query)
      .collation({ locale: 'en', strength: 2 })
      .sort({ name: 1 });
      
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching contacts', error: err.message });
  }
});

// POST: Create a new contact
app.post('/api/contacts', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    if (!name || !email || !phone) {
        return res.status(400).json({ message: "Name, email, and phone fields are required." });
    }

    const newContact = new Contact({ name, email, phone });
    await newContact.save();
    res.status(201).json(newContact);
  } catch (err) {
    // Check for validation errors (like the new phone number rule)
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    // Custom error handling for duplicates
    if (err.code === 11000) {
        return res.status(409).json({ message: 'This phone number is already registered.' }); // 409 Conflict
    }
    res.status(500).json({ message: 'Error creating contact', error: err.message });
  }
});

// PUT: Update an existing contact by ID
app.put('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ message: "Name, email, and phone are required." });
    }

    const updatedContact = await Contact.findByIdAndUpdate(
      id,
      { name, email, phone },
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    if (!updatedContact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json(updatedContact);
  } catch (err) {
     // Check for validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    // Custom error handling for duplicates
    if (err.code === 11000) {
        return res.status(409).json({ message: 'This phone number is already registered.' }); // 409 Conflict
    }
    res.status(500).json({ message: 'Error updating contact', error: err.message });
  }
});

// DELETE: Delete a contact by ID
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedContact = await Contact.findByIdAndDelete(id);

    if (!deletedContact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json({ message: 'Contact deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting contact', error: err.message });
  }
});

// --- CATCH-ALL ROUTE for Frontend ---
// This route should be the last one defined
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

