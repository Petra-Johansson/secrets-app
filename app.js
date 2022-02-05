//jshint esversion:6
require('dotenv').config();                  //keeps secret that should not be shared
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const flash = require('express-flash')
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const MongoClient = require('mongodb').MongoClient;

const auditLog = require('audit-log');
const app = express();
const https = require('https');
const http = require('http');
const fs = require("fs");
const initializePassport = require('./passport-config')

auditLog.addTransport("mongoose", {connectionString: "mongodb://localhost/auditdb"})

const PORT = process.env.PORT || 3000
const uri = process.env.MONGODB;


const options = {
    key: fs.readFileSync('petras-key.pem'),
    cert: fs.readFileSync('petras-cert.pem')
}; 

app.use('/healthcheck', require('./routes/healthcheck.routes'));

app.use(express.static('public')); //use the location for our css
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

//session cookies
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
}));

app.use(passport.initialize()); //starting passport encryption
app.use(passport.session());    //passport starting session cookies

//connection to our Mono DB where we have a document for our users.
//if user registers with Google we can only see the Google ID and submitted Secret
//if user registers via the form, we can see username, encrypted password and secret   
mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});
//mongoose.set("useCreateIndex", true); this is no longer needed in Mongoose 6

const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose); // call plugin save = crypting
userSchema.plugin(findOrCreate);          // call plugin find = decrypting

const User = new mongoose.model("User", userSchema);


passport.use(User.createStrategy());

// skapar cookies with user ID
passport.serializeUser(function(user, done){
    done(null, user.id)
});
// "opens" the cookie to identify user by ID
passport.deserializeUser(function (id, done) {
    User.findById(id, function(err, user){
        done(err, user);
    });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },

  function(accessToken, refreshToken, profile, cb) {
      console.log(profile)

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

// ### LOCAL STRATEGY ###



/* 
### ALL ROUTES ###
*/ 
app.get('/', function(req,res){
    res.render('home')
});

//opens upp window for using google-sign in
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile'] })
);

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect to secrets-page.
    res.redirect('/secrets');
  });

app.get('/login', function(req,res){
    res.render('login')
});
app.get('/register', function(req,res){
    res.render('register')
});

app.get('/secrets', function (req, res){
    //renders all submitted secrets 
    User.find({'secret': {$ne: null}}, function(err, foundUsers){
        if(err){
            console.log(err)
        } else {
            if(foundUsers) {
                res.render('secrets', {usersWithSecrets: foundUsers});
            }
        }
    });
});

//if a user wants to access the /submit-page they need to be logged in 
//- if not, they will be redirected to Log In
app.get('/submit', function (req,res) {
    if(req.isAuthenticated()){
        res.render('submit')
    }else {
        res.redirect('/login');
    }
});

app.post('/submit', function(req, res) {
    const submittedSecret = req.body.secret;

    //  Once the user is authenticated and their session gets saved, 
    //  their user details are saved to req.user.
    //  console.log(req.user.id);

    User.findById(req.user.id, function(err, foundUser){
        if (err) {
            console.log(err)
        } else {
            if(foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save(function(){
                    res.redirect('/secrets');
                });
            }
        }
    });
});

app.get('/logout', function(req, res, next) {
    // remove the req.user property and clear the login session
    req.logout();
  
    // destroy session data
    req.session = null;
  
    // redirect to homepage
    res.redirect('/');
  });


app.post('/register',(req,res)=>{
 
    User.register({username: req.body.username}, req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.redirect('/register');
        } else {
            passport.authenticate('local')(req, res, function(){
                res.redirect('/secrets');
            });
        }
    });
});

app.post('/login', function(req, res){
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    auditLog.logEvent(user.username, 'maybe script name or function',
    "tried to log in", 'the affected target name perhaps', 'target id', 'additional info, JSON, etc.');
    
    req.login(user, function(err){
        if(err){
            console.log(err);
            res.redirect('/login');
        } else{
            passport.authenticate('local')(req, res, function(){
                res.redirect('/secrets');
            });
        }
    });
});


// friendly recaptcha
function recaptcha_callback() {
    var loginBtn = document.querySelector('#login-btn');
    loginBtn.removeAttribute('disabled');
    loginBtn.style.cursor = 'pointer';
}



/*
app.listen(PORT, () =>  {
    console.log('info', `STARTED LISTENING ON PORT ${PORT}`);
});

*/
http.createServer(app).listen(PORT, function(){
  console.log('info', `STARTED LISTENING ON PORT ${PORT}`);
});

https.createServer(options, app).listen(443, function(){
  console.log('HTTPS listening on 443');
});
