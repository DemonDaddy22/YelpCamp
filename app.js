require('dotenv').config();

var express            = require("express"),
    app                = express(),
    bodyParser         = require("body-parser"),
    flash              = require("connect-flash"),
    mongoose           = require("mongoose"),
    passport           = require("passport"),
    LocalStrategy      = require("passport-local"),
    methodOverride     = require("method-override"),
    Campground         = require("./models/campground"),
    Comment            = require("./models/comment"),
    Review             = require("./models/review"),
    User               = require("./models/user"),
    seedDB             = require("./seeds");
    
var campgroundRoutes   = require("./routes/campgrounds"),
    commentRoutes      = require("./routes/comments"),
    reviewRoutes       = require("./routes/reviews"),
    indexRoutes        = require("./routes/index"),
    userRoutes         = require("./routes/users");

mongoose.connect(process.env.DATABASEURL, {useNewUrlParser: true});

app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());

// seedDB(); seed the database

app.locals.moment = require('moment');
// PASSPORT CONFIGURATUION
app.use(require("express-session")({
    secret: "Once again Rusty wins!",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});

// requiring routes
app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:id/reviews", reviewRoutes);
app.use("/campgrounds/:id/comments", commentRoutes);
app.use("/campgrounds/profile", userRoutes);
app.use(indexRoutes);

app.listen(process.env.PORT, process.env.IP, function(){
    console.log("YelpCamp server has started...");
});