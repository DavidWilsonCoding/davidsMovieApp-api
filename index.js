//load express
const express = require('express');
const app = express();
//new comment

//load morgan
const morgan = require('morgan');

//load uuid
const uuid = require('uuid');

//load bodyParser
const bodyParser = require('body-parser');

//load mongoose
const mongoose = require('mongoose');
const Models = require('./models.js');

//import data models
const Movies = Models.Movie;
const Users = Models.User;

//import express-validator
const { check, validationResult } = require('express-validator');

console.log("in index.js");

//connect to locacl MongoDB
// mongoose.connect('mongodb://localhost:27017/davidsMovieAppDB', { useNewUrlParser: true, useUnifiedTopology: true });

// Comnnect to hosted AtlasDB
mongoose.connect( process.env.CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true });

//log request data in terminal
app.use(morgan('common'));

//allow request body to be parsed
app.use(bodyParser.json());

//load CORS
const cors = require('cors');
app.use(cors());

//import auth.js, which generates web tokens based on Username & password
let auth = require('./auth')(app);

//import passport module and passport.js
const passport = require('passport');
require('./passport');

//serve static files from the public directory
app.use(express.static('public'));

/* ********************* */
/* APP ROUTING */
/* ********************* */

//passport.authenticate('jwt', { session: false }), 
//GET all movies
app.get ('/movies', passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.find()
  .then((movies) => {
    res.status(200).json(movies);
  })
  .catch((err) => {
    console.error(error);
    res.status(500).send('Error: ' + err);
  });
});
  
//GET movie data by title
app.get('/movies/:title', passport.authenticate('jwt', { session: false }), (req, res) => {
  //find the movie by title
  Movies.findOne({ Title: req.params.title}) 
  .then((movie) => {
    //If movie was found, return data, else generate error
    if(movie){
      res.status(200).json(movie);
    } else {
      res.status(400).send('Movie not found');
    };
  })
  .catch((err) => {
    res.status(500).send('Error: '+ err);
  });
});

//GET movie genre data by genre name
app.get('/movies/genres/:Name', passport.authenticate('jwt', { session: false }), (req, res) => {
  //find movie by genre name
  Movies.findOne({ 'Genre.Name': req.params.Name})
    .then((movie) => {
      //if a movie with the genre was found, return genre info, else generate an error
      if(movie){ 
        res.status(200).json(movie.Genre);
      } else {
        res.status(400).send('Genre not found');
      };
    })
    .catch((err) => {
      res.status(500).send('Error: '+ err);
    });
    console.log('test2');
});

//GET movie director data by director name
app.get('/movies/directors/:Name', passport.authenticate('jwt', { session: false }), (req, res) => {
  //find one movie with the director by name
  Movies.findOne({ 'Director.Name': req.params.Name}) 
    .then((movie) => {
      // If a movie with the director was found, return director data, else generate an error
      if(movie){ 
        res.status(200).json(movie.Director);
      } else {
        res.status(400).send('Director not found');
      };
    })
    .catch((err) => {
      res.status(500).send('Error: '+ err);
    });
});

//POST new user (to register new user)
app.post('/users',
  // Validation logic here for request
  //you can either use a chain of methods like .not().isEmpty()
  //which means "opposite of isEmpty" in plain english "is not empty"
  //or use .isLength({min: 5}) which means
  //minimum value of 5 characters are only allowed
  [
    check('Username', 'Username with a minimum length of 5 characters is required').isLength({min: 5}),
    check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
    check('Password', 'Password is required').not().isEmpty(),
    check('Email', 'Email does not appear to be valid').isEmail()
  ], (req, res) => {

  // check the validation object for errors
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    let hashedPassword = Users.hashPassword(req.body.Password);
    Users.findOne({ Username: req.body.Username }) // Search to see if a user with the requested username already exists
      .then((user) => {
        if (user) {
          //If the user is found, send a response that it already exists
          return res.status(400).send(req.body.Username + ' already exists');
        } else {
          Users
            .create({
              Username: req.body.Username,
              Password: hashedPassword,
              Email: req.body.Email,
              Birthday: req.body.Birthday
            })
            .then((user) => { res.status(201).json(user) })
            .catch((error) => {
              console.error(error);
              res.status(500).send('Error: ' + error);
            });
        }
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send('Error: ' + error);
      });
    });

//PUT UserName (to allow users to update user data by Username)
app.put('/users/:Username', passport.authenticate('jwt', { session: false }), [
  check('Username', 'Username with a minimum length of 5 characters is required').isLength({min: 5}),
  check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
  check('Password', 'Password is required').not().isEmpty(),
  check('Email', 'Email does not appear to be valid').isEmail()
], (req, res) => {
  
  
  let errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  let hashedPassword = Users.hashPassword(req.body.Password);
  console.log(req.body);
  Users.findOneAndUpdate({ Username : req.params.Username},
    //update user data from request body 
      {$set: {
        Username: req.body.Username,
        Password: hashedPassword,
        Email: req.body.Email,
        Birthday: req.body.Birthday
      }
    },
    //Use updated object as callback parameter
    { new : true }) 
    .then((updatedUser) => {
        //return json object of updatedUser
        res.json(updatedUser); 
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

//POST new movie to user's FavoriteMovies array
app.post('/users/:Username/movies/:MovieID', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOneAndUpdate({Username : req.params.Username}, // Find user by username
    //add movie to FavoriteMovies if not in existing array
    {$addToSet: { FavoriteMovies: req.params.MovieID}},
    //use updated object as callback parameter
    { new : true }) 
    .then((updatedUser) => {
        //return json object of updatedUser
        res.json(updatedUser);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

//DELETE movie from user's topFilms array
app.put('/users/:Username/movies/:MovieID', passport.authenticate('jwt', { session: false }), (req, res) => {
  console.log(req.params.MovieID);
  //find user by username
  Users.findOneAndUpdate({Username : req.params.Username}, 
    //remove movie from the list
    {$pull: { FavoriteMovies: req.params.MovieID}}, 
    //use updated object as callback parameter
    { new : true }) 
    .then((updatedUser) => {
        //return json object of updatedUser
        res.json(updatedUser);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

//DELETE user from users by Username
app.delete('/users/:Username', passport.authenticate('jwt', { session: false }), (req, res) => {
  //find user by username
  Users.findOneAndRemove({ Username : req.params.Username}) 
    .then((user) => {
      //if user was found, return success message, else return error
      if(user){
        res.status(200).send('User with the Username ' + req.params.Username + ' was sucessfully deleted.');
      } else {
        res.status(400).send('User with the Username ' + req.params.Username + ' was not found.');
      };
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
  });
});

//GET user by Username
app.get('/users/:Username', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOne({ Username: req.params.Username })
      .then((user) => {
          res.json(user);
      })
      .catch((err) => {
          console.error(err);
          res.status(500).send('Error: ' + err);
      });
});

//DELETE a user's favorite movie by ID
app.delete(
  "/users/:Username/:MovieID",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Users.findOneAndUpdate(
      { Username: req.params.Username },
      {
        $pull: { FavoriteMovies: req.params.MovieID },
      },
      { new: true }
    )
      .then((updatedInfo) => {
        res.json(updatedInfo);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send("Error: " + err);
      });
  }
);

//POST add a movie to user's favorute movies
// app.post(
//   "/users/:Username/movies/:MovieID",
//   passport.authenticate("jwt", { session: false }),
//   (req, res) => {
//     Users.findOneAndUpdate(
//       { Username: req.params.Username },
//       {
//         $push: { FavoriteMovies: req.params.MovieID },
//       },
//       { new: true }, // This line makes sure that the updated document is returned
//       (err, updatedUser) => {
//         if (err) {
//           console.error(err);
//           res.status(500).send("Error: " + err);
//         } else {
//           res.json(updatedUser);
//         }
//       }
//     );
//   }
// );

//display Welcome message
app.get('/', (req, res) => {
  res.send("Welcome to David's Movie App!");
});
  
//error handling
app.use((err, req, res, next) => {
console.error(err.stack);
res.status(500).send('Oops, there was an error requesting the page');
});


const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0',() => {
console.log('Listening on Port ' + port);
});