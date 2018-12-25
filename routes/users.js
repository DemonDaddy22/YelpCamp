var express      = require("express");
var router       = express.Router();
var Campground   = require("../models/campground");
var User         = require("../models/user");
var middleware   = require("../middleware");

router.get("/", function(req, res){
    return res.redirect("back");
});

// User profile
router.get("/:id", function(req, res) {
  User.findById(req.params.id, function(err, foundUser) {
    if(err || !foundUser) {
      req.flash("error", "User not found. Please try again.");
      return res.redirect("back");
    }
    Campground.find().where("author.id").equals(foundUser._id).exec(function(err, campgrounds) {
      if(err) {
        req.flash("error", "Something went wrong.");
        return res.redirect("back");
      }
      res.render("users/show", {user: foundUser, campgrounds: campgrounds});
    });
  });
});

// EDIT - editing profile
router.get("/:id/edit", middleware.isLoggedIn, function(req, res){
    User.findById(req.params.id, function(err, foundUser){
        if (err){
            req.flash("error", "Oops! Something went wrong.");
            return res.redirect("back");
        }
       res.render("users/edit", {user: foundUser}); 
    });
});

// UPDATE - update the given user profile
router.put("/:id", middleware.isLoggedIn, function(req, res){
    User.findById(req.params.id, function(err, user){
        if(err){
            req.flash("error", err.message);
            res.redirect("back");
        } else {
            user.firstName = req.body.user.firstName;
            user.lastName = req.body.user.lastName;
            user.email = req.body.user.email;
            user.avatar = req.body.user.avatar;
            user.save();
            req.flash("success","Profile Successfully Updated!");
            res.redirect("/campgrounds/profile/" + user._id);
        }
    });
});

module.exports = router;