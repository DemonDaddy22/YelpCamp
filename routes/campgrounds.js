var express      = require("express");
var router       = express.Router();
var Campground   = require("../models/campground");
var Review       = require("../models/review");
var Comment      = require("../models/comment");
var middleware   = require("../middleware");
var NodeGeocoder = require('node-geocoder');
var multer       = require('multer');
var cloudinary   = require('cloudinary');

var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter});

cloudinary.config({ 
  cloud_name: 'yelp-camp', 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});
 
var options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
 
var geocoder = NodeGeocoder(options);

// INDEX - show all campgrounds
router.get("/", function(req, res){
    var noMatch = null;
    if (req.query.q){
        const regex = new RegExp(escapeRegex(req.query.q), "gi");
        Campground.find({name: regex}, function(err, campgrounds){
            if (err){
                req.flash("error", "Oops! Something went wrong.");
                console.log(err);
            }
            else{
                if (campgrounds.length<1){
                    noMatch = "No campgrounds match that query, please try again.";
                }
                res.render("campgrounds/index", {campgrounds: campgrounds, page: "campgrounds", noMatch: noMatch});
            }
        });
    }
    else{
        Campground.find({}, function(err, campgrounds){
            if (err){
                req.flash("error", "Oops! Something went wrong.");
                console.log(err);
            }
            else{
                res.render("campgrounds/index", {campgrounds: campgrounds, page: "campgrounds", noMatch: noMatch});
            }
        });   
    }
});

//CREATE - add new campground to DB
router.post("/", middleware.isLoggedIn, upload.single('image'), function(req, res){
  // get data from form and add to campgrounds array
  var name = req.body.name;
  var price = req.body.price;
  var desc = req.body.description;
  var author = {
      id: req.user._id,
      username: req.user.username
  };
  geocoder.geocode(req.body.location, function (err, data) {
    // console.log(data);
    if (err || data.status === 'ZERO_RESULTS') {
      req.flash('error', 'Invalid address');
      return res.redirect('back');
    }
    var lat = data[0].latitude;
    var lng = data[0].longitude;
    var location = data[0].formattedAddress;
    
    cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
        if (!err){
            var image = result.secure_url;
            var imageId = result.public_id;
            var newCampground = {name: name, image: image, imageId: imageId, price: price, description: desc, author: author, location: location, lat: lat, lng: lng};
            // Create a new campground and save to DB
            Campground.create(newCampground, function(err, newlyCreated){
                if(err){
                    console.log(err);
                    req.flash('error', err.message);
                    return res.redirect("back");
                } else {
                    // redirect back to campgrounds page
                    // console.log(newlyCreated);
                    res.redirect("/campgrounds");
                }
            }); 
        }
    });
  });
});

// NEW - show form to create new campground
router.get("/new", middleware.isLoggedIn, function(req, res){
    res.render("campgrounds/new");
});

//SHOW - show more info about a campground
router.get("/:id", function(req, res){
    Campground.findById(req.params.id).populate("comments").populate({
        path: "reviews",
        options: {sort: {createdAt: -1}}
    }).exec(function(err, foundCampground){
        if(err || !foundCampground){
            console.log(err);
            req.flash('error', 'Sorry, that campground does not exist!');
            return res.redirect('/campgrounds');
        }
        else{
            // console.log(foundCampground);
            res.render("campgrounds/show", {campground: foundCampground});
        }
    });
});

// EDIT - editing campgrounds
router.get("/:id/edit", middleware.checkCampgroundOwnership, function(req, res){
        Campground.findById(req.params.id, function(err, foundCampground){
            if (err){
                req.flash("error", "Oops! Something went wrong.");
                res.redirect("back");
            }
           res.render("campgrounds/edit", {campground: foundCampground}); 
        });
});

// UPDATE - update the given campground
router.put("/:id", middleware.checkCampgroundOwnership, upload.single('image'), function(req, res){
  geocoder.geocode(req.body.location, function(err, data) {
    if (err || !data.length) {
      req.flash('error', 'Invalid address');
      return res.redirect('back');
    }
    req.body.campground.lat = data[0].latitude;
    req.body.campground.lng = data[0].longitude;
    req.body.campground.location = data[0].formattedAddress;

    Campground.findById(req.params.id, async function(err, campground){
        if(err){
            req.flash("error", err.message);
            res.redirect("back");
        } else {
            if (req.file) {
              try {
                  await cloudinary.v2.uploader.destroy(campground.imageId);
                  var result = await cloudinary.v2.uploader.upload(req.file.path);
                  campground.imageId = result.public_id;
                  campground.image = result.secure_url;
              } catch(err) {
                  req.flash("error", err.message);
                  return res.redirect("back");
              }
            }
            campground.name = req.body.campground.name;
            campground.description = req.body.campground.description;
            campground.price = req.body.campground.price;
            campground.lat = req.body.campground.lat;
            campground.lng = req.body.campground.lng;
            campground.location = req.body.campground.location;
            campground.save();
            req.flash("success","Campground Successfully Updated!");
            res.redirect("/campgrounds/" + campground._id);
        }
    });
  });
});

// DESTROY - deleting campground
// -> display name of campground which gets deleted
router.delete("/:id", middleware.checkCampgroundOwnership, function(req, res){
   Campground.findById(req.params.id, async function(err, campground) {
        var name = campground.name;
        if(err) {
          req.flash("error", err.message);
          return res.redirect("back");
        }
        try {
            // deletes all comments associated with the campground
            await Comment.remove({"_id": {$in: campground.comments}});
            // deletes all reviews associated with the campground
            await Review.remove({"_id": {$in: campground.reviews}});
            await cloudinary.v2.uploader.destroy(campground.imageId);
            campground.remove();
            req.flash('success', name + 'deleted successfully!');
            res.redirect('/campgrounds');
                    
        } catch(err) {
              req.flash("error", err.message);
              return res.redirect("back");
            }
    });
});

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router;
