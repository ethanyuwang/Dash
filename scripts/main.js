'use strict';

// Initializes Dash.
function Dash() {
  //this.checkSetup();

  // Shortcuts to DOM Elements.
  this.CardForm = document.getElementById('newCardEditor');
  this.submitButton = document.getElementById('submit');
  this.pauseButton = document.getElementById('pause');

  this.userPic = document.getElementById('user-pic');
  this.userName = document.getElementById('user-name');
  this.signInButton = document.getElementById('sign-in');
  this.signOutButton = document.getElementById('sign-out');
  //this.signInSnackbar = document.getElementById('must-signin-snackbar');

  // Saves Card on form submit.
  this.submitButton.addEventListener('click', this.saveCard.bind(this));
  this.signOutButton.addEventListener('click', this.signOut.bind(this));
  this.signInButton.addEventListener('click', this.signIn.bind(this));
  this.pauseButton.addEventListener('click', this.togglePause.bind(this));

  //control status
  this.paused = false;
  this.cardCount = 0;

  // Toggle for the button. TODO:???
  //var buttonTogglingHandler = this.toggleButton.bind(this);
  //this.CardInput.addEventListener('keyup', buttonTogglingHandler);
  //this.CardInput.addEventListener('change', buttonTogglingHandler);

  this.initFirebase();
}

// Sets up shortcuts to Firebase features and initiate firebase auth.
Dash.prototype.initFirebase = function() {
  // Shortcuts to Firebase SDK features.
  this.auth = firebase.auth();
  this.database = firebase.database();
  this.storage = firebase.storage();
  // Initiates Firebase auth and listen to auth state changes.
  this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
};

// Loads Cards history and listens for upcoming ones.
Dash.prototype.loadCards = function() {
  // Check that the user is signed in. CardForm
  if (this.checkSignedInWithMessage()) {
    var currentUser = this.auth.currentUser;
    // Reference to the /Cards/ database path.
    var userId = currentUser.uid;
    this.CardsRef = this.database.ref(userId+"/Cards");
    // Make sure we remove all previous listeners.
    this.CardsRef.off();

    // Loads the last 12 Cards and listen for new ones.
    var setCard = function(data) {
      var val = data.val();
      this.displayCard(data.key, val.task, val.notes, val.seconds)
    }.bind(this);
    //TODO: think about limit to last 12
    this.CardsRef.limitToLast(12).on('child_added', setCard);
    this.CardsRef.limitToLast(12).on('child_changed', setCard);
  }
};

// Saves a new Card on the Firebase DB.
Dash.prototype.saveCard = function(e) {
  e.preventDefault();
  // Check that the user entered a Card and is signed in. CardForm
  if (this.checkCardInput() && this.checkSignedInWithMessage()) {
    var currentUser = this.auth.currentUser;
    // Add a new Card entry to the Firebase Database.
    var task = $('#taskInput').val();
    var seconds = this.getDurationInputInSeconds();
    var notes= $('#notesInput').val();
    this.CardsRef.push({
      name: currentUser.displayName,
      task: $('#taskInput').val(),
      seconds: this.getDurationInputInSeconds(),
      notes: $('#notesInput').val()
    }).then(function() {
      // Clear Card text field and SEND button state.
      Dash.resetNewCardEditor(this.CardForm);
      this.toggleButton();
    }.bind(this)).catch(function(error) {
      console.error('Error writing new Card to Firebase Database', error);
    });
  }
};

// Signs-in Friendly Chat.
Dash.prototype.signIn = function() {
  // Sign in Firebase using popup auth and Google as the identity provider.
  var provider = new firebase.auth.GoogleAuthProvider();
  this.auth.signInWithPopup(provider);
};

// Signs-out of Friendly Chat.
Dash.prototype.signOut = function() {
  // Sign out of Firebase.
  this.auth.signOut();
};

Dash.prototype.togglePause = function() {
  // Pause/resume countdown
  this.paused = !this.paused;
  //this.pauseButton.getElementById('btnPauseIcon').toggleClass
  //var button = $('.btnPauseIcon');
  //button.toggleClass('fa-pause fa-play');
  //TODO: toggle icon
  $('.btnPauseIcon').toggleClass('fa-pause');
  $('.btnPauseIcon').toggleClass('fa-play');
};

// close a card
Dash.prototype.closeCard = function(e, key){
  e.preventDefault(); 
  //delete from database
  if (this.checkSignedInWithMessage()) {
    // Delete the Card entry from the Firebase Database with the key.
    this.CardsRef.child(key).remove();/*.catch(function(error) {
      console.error('Error deleteing a card from Firebase Database', error);
    });*/
    // Remove the card from list
    var $target = $('.'+key);
    $target.remove();
    //$target.hide(function(){ $target.remove(); });
  }
};

// Triggers when the auth state change for instance when the user signs-in or signs-out.
Dash.prototype.onAuthStateChanged = function(user) {
  if (user) { // User is signed in!
    // Get profile pic and user's name from the Firebase user object.
    var profilePicUrl = user.photoURL;
    var userName = user.displayName;

    // Set the user's profile pic and name.
    this.userPic.style.backgroundImage = 'url(' + (profilePicUrl || '/images/profile_placeholder.png') + ')';
    this.userName.textContent = userName;

    // Show user's profile and sign-out button.
    this.userName.removeAttribute('hidden');
    this.userPic.removeAttribute('hidden');
    this.signOutButton.removeAttribute('hidden');

    // Hide sign-in button.
    this.signInButton.setAttribute('hidden', 'true');

    // We load currently existing chant Cards.
    this.loadCards();

    //TODO: We save the Firebase Messaging Device token and enable notifications.
    //this.saveMessagingDeviceToken();
  } else { // User is signed out!
    // Hide user's profile and sign-out button.
    this.userName.setAttribute('hidden', 'true');
    this.userPic.setAttribute('hidden', 'true');
    this.signOutButton.setAttribute('hidden', 'true');

    // Show sign-in button.
    this.signInButton.removeAttribute('hidden');
  }
};

// Returns true if new card info is valid.
Dash.prototype.checkCardInput = function() {
  //TODO: make sure duration isnt 0 and task or notes at least have to have one filled
  return true;
};

// Returns true if user is signed-in. Otherwise false and displays a Card.
Dash.prototype.checkSignedInWithMessage = function() {
  // Return true if the user is signed in Firebase
  if (this.auth.currentUser) {
    return true;
  }

  // Display a Card to the user using a Toast.
  var data = {
    Card: 'You must sign-in first',
    timeout: 2000
  };
  //this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
  return false;
};

// Saves the messaging device token to the datastore.
Dash.prototype.saveMessagingDeviceToken = function() {
  firebase.messaging().getToken().then(function(currentToken) {
    if (currentToken) {
      console.log('Got FCM device token:', currentToken);
      // Saving the Device Token to the datastore.
      firebase.database().ref('/fcmTokens').child(currentToken)
          .set(firebase.auth().currentUser.uid);
    } else {
      // Need to request permissions to show notifications.
      this.requestNotificationsPermissions();
    }
  }.bind(this)).catch(function(error){
    console.error('Unable to get messaging token.', error);
  });
};

// Requests permissions to show notifications.
Dash.prototype.requestNotificationsPermissions = function() {
  console.log('Requesting notifications permission...');
  firebase.messaging().requestPermission().then(function() {
    // Notification permission granted.
    this.saveMessagingDeviceToken();
  }.bind(this)).catch(function(error) {
    console.error('Unable to get permission to notify.', error);
  });
};

// Resets the given MaterialTextField.
Dash.prototype.resetNewCardEditor = function(element) {
  $('#taskPanel').val("");
  $('#duration-hours').val(0);
  $('#duration-minutes').val(0);
  $('#duration-seconds').val(0);
  $('#notesPanel').val("");
};

// TODO: update Template for Cards.

Dash.prototype.newCardHTML = function(key) {

  var Card_COLOR_CLASSES = ["bg-primary", "bg-warning", "bg-success", "bg-danger"];
  var Card_ICON_CLASSES = ["fa-grav", "fa-bolt", "fa-diamond", "fa-code", "fa-beer", "fa-telegram", "fa-superpowers", "fa-heartbeat"];

  var cardColor = Card_COLOR_CLASSES[this.cardCount%Card_COLOR_CLASSES.length];
  var cardIcon = Card_ICON_CLASSES[this.cardCount%Card_ICON_CLASSES.length];

  var cardHTML = '<div class="col-lg-3 col-md-4 col-sm-6 mb-3 cardColumn" id="' + key + '">' +
                    '<div class="card text-white ' + cardColor + ' o-hidden h-100">' +
                      '<div class="card-body">' +
                        '<div class="card-body-icon">' +
                          '<i class="fa fa-fw ' + cardIcon + ' "></i>' +
                        '</div>' +
                        '<div class="mr-5">' +
                          '<input type="text" class="form-control transparent-input text-white bg-primary o-hidden h-100 task"></input>' +
                          '<textarea class="form-control transparent-input text-white o-hidden h-100 notes" rows="3"></textarea>' +          
                        '</div>' +
                      '</div>' +
                      '<div class="card-footer text-white clearfix small z-1">' +
                        '<span class="card-block card-duration-section">'+
                          '<input type="text" id="duration'+key+'" name="duration">' +
                        '</span>' +
                        '<button type="button" class="btn text-white card-buttons close" data-target="#'+key+'" data-dismiss="alert" id=close'+key+'>' + 
                          '<i class="fa fa-remove"></i>' + 
                        '</button>' +
                      '</div>' +
                    '</div>' +
                  '</div>';
  return cardHTML;
};

// A loading image URL.
Dash.LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif';

// Displays a Card in the UI.
Dash.prototype.displayCard = function(key, task, notes, seconds) {
  var div = document.getElementById(key);
  // If an element for that Card does not exists yet we create it.
  if (!div) {
    var myDiv = $(this.newCardHTML(key));
    this.cardCount++;
    myDiv.insertBefore('#newCardEditor');
    //initialize timepicker for each new card and assign unique ids for hours and minutes sections
    $("#duration"+key).durationPicker({
        hours: {
            label: "h",
            min: 0,
            max: 24,
            id: "hours"+key
        },
        minutes: {
            label: "m",
            min: 0,
            max: 59,
            id: "minutes"+key
        },
        seconds: {
            label: "s",
            min: 0,
            max: 59,
            id: "seconds"+key
        },
        classname: 'form-control',
        type: 'number',
        responsive: true
    });
    //initialize close button

    //document.getElementById(key+"close").addEventListener('click', this.closeCard.bind(key));
    //Add event listener for removing the card from database TODO: consider seperate this to a function
    document.getElementById("close"+key).addEventListener('click', function(e) {
      e.preventDefault(); 
      //delete from database
      if (Dash.checkSignedInWithMessage()) {
        // Delete the Card entry from the Firebase Database with the key.
        Dash.CardsRef.child(key).remove().catch(function(error) {
          console.error('Error deleteing a card from Firebase Database', error);
        });
      }
    }, false);
    div = myDiv;
  }
  //Populate data TODO: consider seperate this to a function
  if(task) {
    $("#"+key+" .task").val(task);
    //div.querySelector('.task').textContent = task;
  }
  if(seconds>=0) {
    //set time for each new card
    var hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    var minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    //TODO: wrap duration hours minutes and seconds inside div
    document.getElementById("duration-hours"+key).value = hours;
    document.getElementById("duration-minutes"+key).value = minutes;
    document.getElementById("duration-seconds"+key).value = seconds;
  }
  if(notes) {
    $("#"+key+" .notes").val(notes);
    //div.querySelector('.notes').textContent = notes;
  }
};

//Convert duration input to seconds
Dash.prototype.getDurationInputInSeconds = function() {
  var hours =  $('#duration-hours').val();
  hours = hours ? parseInt(hours) : 0
  var minutes = $('#duration-minutes').val();
  minutes = minutes ? parseInt(minutes) : 0
  var seconds = $('#duration-seconds').val();
  seconds = seconds ? parseInt(seconds) : 0

  return hours*3600+minutes*60+seconds;
}

Dash.prototype.getDurationInputInSecondsWithKey = function(key) {
  var hours =  $('#duration-hours'+key).val();
  hours = hours ? parseInt(hours) : 0
  var minutes = $('#duration-minutes'+key).val();
  minutes = minutes ? parseInt(minutes) : 0
  var seconds = $('#duration-seconds'+key).val();
  seconds = seconds ? parseInt(seconds) : 0

  return hours*3600+minutes*60+seconds;
}

// TODO: Update durations
Dash.prototype.updateDuration = function() {
}

// TODO: Enables or disables the submit button depending on the values of the input
// fields.
Dash.prototype.toggleButton = function() {
  /*if (this.CardInput.value) {
    this.submitButton.removeAttribute('disabled');
  } else {
    this.submitButton.setAttribute('disabled', 'true');
  }*/
};

window.onload = function() {
  window.Dash = new Dash();
};

//TODO: fix seconds*2
setInterval(function() {
  //find first card
  if (Dash.paused) return;
  var firstCard = $( ".cardColumn" ).first();
  if (firstCard!=null&&(!firstCard.is("#newCardEditor"))) {
    var key = firstCard.attr('id');
    var seconds = Dash.getDurationInputInSecondsWithKey(key);
    if (Dash.checkSignedInWithMessage()) {
      if (seconds>0) {
        //update card's duration on the database
        Dash.CardsRef.child(key).update({ seconds: seconds-1 }).catch(function(error) {
          console.error("Error updating a card's duration to Firebase Database", error);
        });
      }
      else {
        //close the card when time is up
        $('#'+key+'close').click();
      }
    }
  }
}, 1000);



/*Dash.Card_TEMPLATE =
    '<div class="col-lg-3 col-md-4 col-sm-6 mb-3 cardColumn">' +
      '<div class="card text-white bg-danger o-hidden h-100">' +
        '<div class="card-body">' +
          '<div class="card-body-icon">' +
            '<i class="fa fa-fw fa-list"></i>' +
          '</div>' +
          '<div class="mr-5">' +
            '<input type="text" class="form-control transparent-input text-white bg-primary o-hidden h-100 task" placeholder="Your next task" ></input>' +
            '<textarea class="form-control transparent-input text-white o-hidden h-100 task" rows="3" placeholder="Add some notes..." ></textarea>' +          
          '</div>' +
        '</div>' +
        '<div class="card-footer text-white clearfix small z-1">' +
          '<span class="card-block card-duration-section">'+
            '<input type="text" id="duration" name="duration">' +
          '</span>' +
          '<button type="button" class="btn text-white card-buttons close" id="submit">' + 
            '<i class="fa fa-plus"></i>' + 
          '</button>' =
        '</div>' =
      '</div>' +
    '</div>';*/