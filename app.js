const express = require('express');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
const SECRET = 'snapvibe_secret_key';

// MongoDB connect
mongoose.connect('mongodb+srv://manaskumarndi0_db_user:SnapVibe123@cluster0.wd1iehn.mongodb.net/snapvibe?appName=Cluster0')
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.log('DB Error:', err));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  name: String, username: String, email: String, password: String
}));

const Post = mongoose.model('Post', new mongoose.Schema({
  username: String, name: String, caption: String,
  image: String, likes: [String],
  comments: [{ username: String, comment: String }],
  createdAt: { type: Date, default: Date.now }
}));

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get('/feed', (req, res) => res.sendFile(path.join(__dirname, 'views', 'feed.html')));

// Register
app.post('/api/register', async (req, res) => {
  const { name, username, email, password } = req.body;
  if (await User.findOne({ email })) return res.json({ success: false, message: 'Email already registered!' });
  const hashed = await bcrypt.hash(password, 10);
  await User.create({ name, username, email, password: hashed });
  res.json({ success: true, message: 'Register ho gaye! Ab login karo.' });
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.json({ success: false, message: 'Email nahi mila!' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.json({ success: false, message: 'Password galat hai!' });
  const token = jwt.sign({ id: user._id, name: user.name, username: user.username }, SECRET);
  res.json({ success: true, token, name: user.name, username: user.username });
});

// Upload post
app.post('/api/post', upload.single('image'), async (req, res) => {
  const { caption, username, name } = req.body;
  const post = await Post.create({ username, name, caption, image: '/uploads/' + req.file.filename });
  res.json({ success: true, post });
});

// Get posts
app.get('/api/posts', async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

// Like
app.post('/api/like/:id', async (req, res) => {
  const post = await Post.findById(req.params.id);
  const { username } = req.body;
  if (!post) return res.json({ success: false });
  const idx = post.likes.indexOf(username);
  if (idx === -1) post.likes.push(username);
  else post.likes.splice(idx, 1);
  await post.save();
  res.json({ success: true, likes: post.likes.length });
});

// Comment
app.post('/api/comment/:id', async (req, res) => {
  const post = await Post.findById(req.params.id);
  const { username, comment } = req.body;
  if (!post) return res.json({ success: false });
  post.comments.push({ username, comment });
  await post.save();
  res.json({ success: true, comments: post.comments });
});

app.listen(3000, () => console.log('SnapVibe port 3000 pe chal raha hai!'));

// Story Model
const Story = mongoose.model('Story', new mongoose.Schema({
  username: String, name: String, caption: String,
  media: String, createdAt: { type: Date, default: Date.now, expires: 86400 }
}));

// Story page
app.get('/story', (req, res) => res.sendFile(path.join(__dirname, 'views', 'story.html')));

// Upload story
app.post('/api/story', upload.single('media'), async (req, res) => {
  const { caption, username, name } = req.body;
  const story = await Story.create({ username, name, caption, media: '/uploads/' + req.file.filename });
  res.json({ success: true, story });
});

// Get stories
app.get('/api/stories', async (req, res) => {
  const stories = await Story.find().sort({ createdAt: -1 });
  res.json(stories);
});
