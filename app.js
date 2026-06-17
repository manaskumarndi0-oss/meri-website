const express = require('express');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
const SECRET = 'snapvibe_secret_key';

mongoose.connect('mongodb+srv://manaskumarndi0_db_user:SnapVibe123@cluster0.wd1iehn.mongodb.net/snapvibe?appName=Cluster0')
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.log('DB Error:', err));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  username: String,
  email: String,
  password: String,
  bio: { type: String, default: '' },
  profilePic: { type: String, default: '/uploads/default.png' },
  followers: [String],
  following: [String]
}));

const Post = mongoose.model('Post', new mongoose.Schema({
  username: String, name: String, caption: String,
  image: String, likes: [String],
  comments: [{ username: String, comment: String }],
  createdAt: { type: Date, default: Date.now }
}));

const Story = mongoose.model('Story', new mongoose.Schema({
  username: String, name: String,
  media: String, caption: String,
  createdAt: { type: Date, default: Date.now, expires: 86400 }
}));

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Auth middleware
function auth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.json({ success: false, message: 'Login karo pehle!' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.json({ success: false, message: 'Invalid token!' });
  }
}

// Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get('/feed', (req, res) => res.sendFile(path.join(__dirname, 'views', 'feed.html')));
app.get('/story', (req, res) => res.sendFile(path.join(__dirname, 'views', 'story.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'views', 'profile.html')));

// Register
app.post('/api/register', async (req, res) => {
  const { name, username, email, password } = req.body;
  if (await User.findOne({ email })) return res.json({ success: false, message: 'Email already registered!' });
  if (await User.findOne({ username })) return res.json({ success: false, message: 'Username already taken!' });
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

// Follow / Unfollow
app.post('/api/follow/:targetUsername', auth, async (req, res) => {
  const me = req.user.username;
  const target = req.params.targetUsername;
  if (me === target) return res.json({ success: false, message: 'Khud ko follow nahi kar sakte!' });
  const myUser = await User.findOne({ username: me });
  const targetUser = await User.findOne({ username: target });
  if (!targetUser) return res.json({ success: false, message: 'User nahi mila!' });
  const idx = myUser.following.indexOf(target);
  if (idx === -1) {
    myUser.following.push(target);
    targetUser.followers.push(me);
    await myUser.save();
    await targetUser.save();
    res.json({ success: true, action: 'followed', followers: targetUser.followers.length });
  } else {
    myUser.following.splice(idx, 1);
    targetUser.followers.splice(targetUser.followers.indexOf(me), 1);
    await myUser.save();
    await targetUser.save();
    res.json({ success: true, action: 'unfollowed', followers: targetUser.followers.length });
  }
});

// Get profile
app.get('/api/profile/:username', async (req, res) => {
  const user = await User.findOne({ username: req.params.username }).select('-password');
  if (!user) return res.json({ success: false, message: 'User nahi mila!' });
  const posts = await Post.find({ username: req.params.username }).sort({ createdAt: -1 });
  res.json({ success: true, user, posts });
});

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

app.listen(3000, () => console.log('SnapVibe port 3000 pe chal raha hai!'));

// Search users
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  const users = await User.find({
    $or: [
      { username: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } }
    ]
  }).select('-password').limit(10);
  res.json(users);
});

// Explore page
app.get('/explore', (req, res) => res.sendFile(path.join(__dirname, 'views', 'explore.html')));

// ===== PUSH NOTIFICATIONS + NOTIFICATIONS SYSTEM =====
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:snapvibe@example.com',
  'BO5ridjbmID1Wroza2yYOOV4OmMsyuWh5jrR8g4heh0ZmkKWPWBxeA-aQfvAQBERt8seBEBqJfjZ7NCnZ432Ayk',
  'eZIJwGI4-7T-bV2jlcsJvJgLrItmF-tJTEJeJKKNP-8'
);

const PushSubscription = mongoose.model('PushSubscription', new mongoose.Schema({
  username: String,
  subscription: Object
}));

const Notification = mongoose.model('Notification', new mongoose.Schema({
  toUser: String,
  fromUser: String,
  type: String,
  message: String,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}));

// Save push subscription
app.post('/api/push/subscribe', auth, async (req, res) => {
  const { subscription } = req.body;
  await PushSubscription.findOneAndUpdate(
    { username: req.user.username },
    { username: req.user.username, subscription },
    { upsert: true }
  );
  res.json({ success: true });
});

// Get notifications
app.get('/api/notifications', auth, async (req, res) => {
  const notifs = await Notification.find({ toUser: req.user.username }).sort({ createdAt: -1 }).limit(20);
  res.json(notifs);
});

// Mark all read
app.post('/api/notifications/read', auth, async (req, res) => {
  await Notification.updateMany({ toUser: req.user.username }, { read: true });
  res.json({ success: true });
});

// Helper: send notification
async function sendNotification(toUser, fromUser, type, message) {
  await Notification.create({ toUser, fromUser, type, message });
  const sub = await PushSubscription.findOne({ username: toUser });
  if (sub) {
    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify({
        title: 'SnapVibe',
        body: message,
        icon: '/icon.png'
      }));
    } catch (e) { console.log('Push error:', e.message); }
  }
}

// Notifications page
app.get('/notifications', (req, res) => res.sendFile(path.join(__dirname, 'views', 'notifications.html')));
