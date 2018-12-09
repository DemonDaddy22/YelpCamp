var express     = require("express");
var router      = express.Router({mergeParams: true});
var Campground  = require("../models/campground");
var Comment     = require("../models/comment");
var middleware  = require("../middleware");

// COMMENTS NEW
router.get("/new", middleware.isLoggedIn, function(req, res){
    // find campground by ID
    Campground.findById(req.params.id, function(err, campground){
        if (err){
            req.flash("error", "Oops! Something went wrong.");
            console.log(err);
        }
        else{
            res.render("comments/new", {campground: campground});
        }
    });
});

// COMMENTS CREATE
router.post("/", middleware.isLoggedIn, function(req, res){
    // lookup camground using ID
    Campground.findById(req.params.id, function(err, campground){
        if (err){
            console.log(err);
            req.flash("error", "Oops! Something went wrong.");
            res.redirect("/campgrounds");
        }
        else{
            Comment.create(req.body.comment, function(err, comment){
                if (err){
                    req.flash("error", "Oops! Something went wrong.");
                    console.log(err);
                }
                else{
                    // add username and id to comment
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;
                    // save comment
                    comment.save();
                    campground.comments.push(comment);
                    campground.save();
                    req.flash("success", "Comment created successfully!");
                    res.redirect("/campgrounds/" + campground._id);
                }
            });
        }
    });
});

// EDIT - editing a comment
router.get("/:comment_id/edit", middleware.checkCommentOwnership, function(req, res){
    Comment.findById(req.params.comment_id, function(err, foundComment){
        if (err){
            req.flash("error", "Oops! Something went wrong.");
            res.redirect("back");
        }
        else{
            res.render("comments/edit", {campground_id: req.params.id, comment: foundComment});
        }
    });
});

// UPDATE- update comment
router.put("/:comment_id", middleware.checkCommentOwnership, function(req, res){
   Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment){
       if (err){
           req.flash("error", "Oops! Something went wrong.");
           res.redirect("back");
       }
       else{
           req.flash("success", "Comment updated successfully!");
           res.redirect("/campgrounds/" + req.params.id);
       }
   });
});

// DESTROY - deleting a comment
router.delete("/:comment_id", middleware.checkCommentOwnership, function(req, res){
    Comment.findByIdAndRemove(req.params.comment_id, function(err){
        if (err){
            req.flash("error", "Oops! Something went wrong.");
            res.redirect("back");
        }
        Campground.findByIdAndUpdate(req.params.id, {$pull: {comments: req.params.comment_id}}, {new: true}).populate("comments").exec(function (err, campground){
            if (err){
                req.flash("error", "Oops! Something went wrong.");
                res.redirect("back");
            }
            campground.save();
            req.flash("success", "Comment deleted successfully!");
            res.redirect("/campgrounds/" + req.params.id);   
        });
    });
});

module.exports = router;