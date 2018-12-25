var express       = require("express");
var router        = express.Router();
var User          = require("../models/user");
var Campground    = require("../models/campground");
var passport      = require("passport");
var async         = require("async");
var crypto        = require("crypto");
var nodemailer    = require("nodemailer");
var middleware    = require("../middleware");

// root route
router.get("/", function(req, res){
    res.render("landing");
});

// sign up route
router.get("/register", function(req, res){
    res.render("register", {page: "register"});
});

// handle register logic
router.post("/register", function(req, res){
    // eval(require("locus"));
    var newUser = new User({
        username: req.body.username, 
        firstName: req.body.firstName, 
        lastName: req.body.lastName, 
        email: req.body.email, 
        avatar: req.body.avatar
    });
    if (req.body.adminCode == "RXmg49_qwf6hvob"){
        newUser.isAdmin = true;
    }
    User.register(newUser, req.body.password, function(err, user){
        if (err){
            console.log(err);
            req.flash("error", "That e-mail ID is already being used by someone else, please try again with a different e-mail ID");
            return res.redirect("/register");
        }
        passport.authenticate("local")(req, res, function(){
            req.flash("success", "Successfully Signed Up! Nice to meet you " + req.body.username + "!");
            res.redirect("/campgrounds");
        });
    });
});

// LOGIN FORM
router.get("/login", function(req, res){
    res.render("login", {page: "login"});
});

// handle login logic
router.post("/login", passport.authenticate("local", {
    successRedirect: "/campgrounds",
    failureRedirect: "/login",
    successFlash: "You have successfully logged in!",
    failureFlash: "Oops! You could not be logged in. Try again."
}), function(req, res){
});

//logout logic
router.get("/logout", function(req, res){
    req.logout();
    req.flash("success", "Logged You Out");
    res.redirect("/campgrounds");
});

// password change route
router.get("/campgrounds/pw/changepw", middleware.isLoggedIn, function(req, res){
    res.render("change");
});

router.post('/campgrounds/pw/changepw', middleware.isLoggedIn, function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (err || !user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/campgrounds/pw/changepw');
        }
        
        if (req.user.email != user.email){
          req.flash('error', 'Specified email does not match your email.');
          return res.redirect('/campgrounds/pw/changepw');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'yelp.camp.help@gmail.com',
          pass: process.env.MYPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'yelp.camp.help@gmail.com',
        subject: 'Node.js Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/campgrounds/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        console.log('mail sent');
        req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/campgrounds');
  });
});

// password reset route
router.get('/campgrounds/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (err || !user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/campgrounds/pw/changepw');
    }
    res.render('reset', {user: user,token: req.params.token});
  });
});

router.post('/campgrounds/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (err || !user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('back');
        }
        if(req.body.password === req.body.confirm) {
            user.setPassword(req.body.password, function(err) {
                if (!err){
                    user.resetPasswordToken = undefined;
                    user.resetPasswordExpires = undefined;
                    user.save(function(err) {
                        if (!err){
                            req.logIn(user, function(err) {
                                done(err, user);
                            });
                        }
                    }); 
                }
            });
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect('back');
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'yelp.camp.help@gmail.com',
          pass: process.env.MYPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'yelp.camp.help@gmail.com',
        subject: 'Your YelpCamp Password has been changed.',
        text: 'Hello ' + user.username + '!\n\n' +
          'This is a confirmation e-mail that the password for your YelpCamp account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'You password has been successfully updated!');
        done(err);
      });
    }
],  function(err) {
        if (err){
            return res.redirect("back");
        }
        res.redirect('/campgrounds');
  });
});

router.get("*", function(req, res){
    req.flash("error", "Sorry! That page does not exist.");
    res.redirect("/");
});

module.exports = router;