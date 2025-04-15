require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/printease', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error(err));

// Schemas
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const PrintJobSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  files: [{
    filename: String,
    path: String,
    pages: Number
  }],
  settings: {
    colorMode: { type: String, enum: ['bw', 'color'], default: 'bw' },
    paperSize: { type: String, enum: ['A4', 'A3', 'A2', 'A1'], default: 'A4' },
    copies: { type: Number, default: 1 },
    orientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' }
  },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'cancelled'],
    default: 'pending'
  },
  totalPrice: Number,
  center: { type: mongoose.Schema.Types.ObjectId, ref: 'PrintingCenter' },
  createdAt: { type: Date, default: Date.now }
});

const PrintingCenterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  distance: Number,
  rating: Number,
  active: { type: Boolean, default: true }
});

const User = mongoose.model('User', UserSchema);
const PrintJob = mongoose.model('PrintJob', PrintJobSchema);
const PrintingCenter = mongoose.model('PrintingCenter', PrintingCenterSchema);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.id);
    if (!user) throw new Error();
    req.user = user;
    next();
  } catch (err) {
    res.status(401).send({ error: 'Please authenticate' });
  }
};

const admin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).send({ error: 'Admin access required' });
  }
  next();
};

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: 'User exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    res.status(201).json({ token, user: { id: user._id, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    res.json({ token, user: { id: user._id, email, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jobs', auth, async (req, res) => {
  try {
    const job = new PrintJob({ ...req.body, user: req.user.id });
    await job.save();
    io.emit('new-job', job);
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/jobs', auth, admin, async (req, res) => {
  try {
    const jobs = await PrintJob.find().populate('user', 'email').populate('center', 'name location');
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/jobs/:id', auth, admin, async (req, res) => {
  try {
    const job = await PrintJob.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    io.emit('job-updated', job);
    res.json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/centers', auth, admin, async (req, res) => {
  try {
    const center = new PrintingCenter({
      ...req.body,
      rating: Math.floor(Math.random() * 3) + 3.5,
      distance: (Math.random() * 5).toFixed(1)
    });
    await center.save();
    io.emit('center-updated');
    res.status(201).json(center);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/centers', auth, async (req, res) => {
  try {
    const centers = await PrintingCenter.find();
    res.json(centers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/centers/:id', auth, admin, async (req, res) => {
  try {
    await PrintingCenter.findByIdAndDelete(req.params.id);
    io.emit('center-updated');
    res.json({ message: 'Center deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log('New client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));
});

PrintJob.watch().on('change', (change) => {
  if (change.operationType === 'insert') {
    PrintJob.findById(change.documentKey._id)
      .populate('user', 'email')
      .then(job => io.emit('new-job', job));
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  seedData();
});

async function seedData() {
  const centers = await PrintingCenter.countDocuments();
  if (centers === 0) {
    await PrintingCenter.insertMany([
      { name: 'AISSMS IOIT XEROX', location: 'Mangalwar Peth', rating: 4.5, distance: 0.5 },
      { name: 'COEP XEROX', location: 'COEP COLLEGE', rating: 4.8, distance: 1.2 }
    ]);
  }
  const users = await User.countDocuments();
  if (users === 0) {
    const hashedPass = await bcrypt.hash('admin123', 10);
    await User.create({ email: 'admin@printease.com', password: hashedPass, isAdmin: true });
  }
}