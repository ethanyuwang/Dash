'use strict';

// Initializes Dash.
function Dash() {
  //this.checkSetup();

  // Shortcuts to DOM Elements.
  this.CardList = document.getElementById('Cards');
  
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
  this.pauseButton.addEventListener('click', this.pauseToggle.bind(this));
  this.signOutButton.addEventListener('click', this.signOut.bind(this));
  this.signInButton.addEventListener('click', this.signIn.bind(this));

  //control status
  this.paused = false;

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
  // Reference to the /Cards/ database path.
  this.CardsRef = this.database.ref('Cards');
  // Make sure we remove all previous listeners.
  this.CardsRef.off();

  // Loads the last 12 Cards and listen for new ones.
  var setCard = function(data) {
    var val = data.val();
    this.displayCard(data.key, val.task, val.notes, val.seconds);
  }.bind(this);
  //TODO: think about limit to last 12
  this.CardsRef.limitToLast(12).on('child_added', setCard);
  this.CardsRef.limitToLast(12).on('child_changed', setCard);
};

// Saves a new Card on the Firebase DB.
Dash.prototype.saveCard = function(e) {
  e.preventDefault();
  // Check that the user entered a Card and is signed in. CardForm
  if (this.checkCardInput() && this.checkSignedInWithMessage()) {
    var currentUser = this.auth.currentUser;
    // Add a new Card entry to the Firebase Database.
    this.CardsRef.push({
      name: currentUser.displayName,
      task: $('#taskPanel').val(),
      seconds: this.getDurationInputInSeconds(),
      notes: $('#notesPanel').val()
    }).then(function() {
      // Clear Card text field and SEND button state.
      Dash.resetNewCardEditor(this.CardForm);
      this.toggleButton();
    }.bind(this)).catch(function(error) {
      console.error('Error writing new Card to Firebase Database', error);
    });
  }
};

// Pause counter or resume counter
Dash.prototype.pauseToggle = function() {
  this.pausing = !this.pausing;
  $(this).find('i').toggleClass('fa-pause fa-play');
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

// close a card
Dash.prototype.closeCard = function(key){
  //e.stopPropagation();  
  var $target = $('.'+key);
  //var $target = $(this).parents('.sprintCard');
  $target.hide(function(){ $target.remove(); });
  //get numeric id
  var cardId = key.match(/\d/g);
  cardId = cardId.join("");
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
  this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
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
Dash.Card_TEMPLATE =
    '<div class="Card-container">' +
      '<div class="spacing"><div class="pic"></div></div>' +
      '<div class="Card"></div>' +
      '<div class="name"></div>' +
    '</div>';

// A loading image URL.
Dash.LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif';

// Displays a Card in the UI.
Dash.prototype.displayCard = function(key, task, notes, seconds) {
  var div = document.getElementById(key);
  // If an element for that Card does not exists yet we create it.
  if (!div) {
    /*var container = document.createElement('div');
    container.innerHTML = Dash.Card_TEMPLATE;
    div = container.firstChild;
    div.setAttribute('id', key);
    this.CardList.appendChild(div);*/
    //--------TODO: update old method of creating new card to using Card_TEMPLATE
    var myCol = $('<div class="col-sm-4 col-md-2 sprintCard mx-auto" id="'+key+'"></div>');
    var myPanel = $('<div class="card" id="'+key+'Panel"> <div class="card-block"> <input class="form-control task" type="text"/> </div><div class="card-block"> <input type="text" id="'+key+'duration" name="duration"> </div><div class="card-block card-notes-section"> <div class="form-group"> <textarea class="form-control notes" rows="4"> </textarea> </div></div><div class="card-block card-buttons-section"> <div class="row"> <button type="button" class="btn card-buttons close" data-target="#'+key+'Panel" data-dismiss="alert" id="'+key+'close"> <i class="fa fa-remove"></i> </button> </div></div></div>')
    myPanel.appendTo(myCol);
    myCol.insertBefore('#newCardEditor');
    //initialize timepicker for each new card and assign unique ids for hours and minutes sections
    $("#"+key+"duration").durationPicker({
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
    $('.close').onclick = this.closeCard(key);
    //$('.close').on('click', this.closeCard(e, key));
    //$('.close').addEventListener('click', this.saveCard.bind(this));
    div = myCol;
  }
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

  /*var hours = parseInt($('#duration-hours').val());
  var minutes = parseInt($('#duration-minutes').val());
  var seconds = parseInt($('#duration-seconds').val());*/
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
