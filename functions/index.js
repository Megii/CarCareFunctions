/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

/**
 * Triggers when a user gets a new follower and sends a notification.
 *
 * Followers add a flag to `/followers/{followedUid}/{followerUid}`.
 * Users save their device notification tokens to `/users/{followedUid}/notificationTokens/{notificationToken}`.
 */
exports.sendFollowerNotification = functions.database.ref('/messages/{timestamp}').onWrite(event => {
  const timestamp = event.params.timestamp;
  // If un-follow we exit the function.


  // Get the list of device notification tokens.
  const getDeviceTokensPromise = admin.database().ref(`/messages/${timestamp}/to`).once('value');

  const getSenderToken = admin.database().ref(`/messages/${timestamp}/from`).once('value');

  const getMsgFlag = admin.database().ref(`/messages/${timestamp}/msg`).once('value');


  return Promise.all([getDeviceTokensPromise, getSenderToken, getMsgFlag]).then(results => {
    const tokensSnapshot = results[0];
    const sender = results[1];
    const msgFlag = results[2];

    console.log('dupa', sender.val());

    // Check if there are any device tokens.
    if (!tokensSnapshot.hasChildren()) {
      return console.log('There are no notification tokens to send to.');
    }
    console.log('There are', tokensSnapshot.numChildren(), 'tokens to send notifications to.');
    console.log('Fetched follower profile', sender);

    // const getMsg = admin.database().ref(`/flags/${msgFlag}`).once('value');

    // const getSenderInfo = admin.database().ref(`/users/${sender}/nr`).once('value');

    // Notification details.
    const payload = {
      notification: {
        title: `CarCare`,
        body: `${msgFlag.val()}`,
      }
    };

    // Listing all tokens.
    let tokens = [];

    for(let key in tokensSnapshot.val()) {
      tokens.push(tokensSnapshot.val()[key]);
    }

    // Send notifications to all tokens.
    return admin.messaging().sendToDevice(tokens, payload).then(response => {
      // For each message check if there was an error.
      const tokensToRemove = [];
      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          console.error('Failure sending notification to', tokens[index], error);
          // Cleanup the tokens who are not registered anymore.
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
            tokensToRemove.push(tokensSnapshot.ref.child(tokens[index]).remove());
          }
        }
      });
      return Promise.all(tokensToRemove);
    });
  });
});

exports.updateUserList = functions.database.ref('/users/{userId}/coords').onWrite(event => {
  const userId = event.params.userId;

  const getUsersList = admin.database().ref(`/users`).once('value');
  const getUserCoords = admin.database().ref(`/users/${userId}/coords`).once('value');

  const radians = function(degrees) {
    return degrees * Math.PI / 180;
  };

  const degrees = function(radians) {
    return radians * 180 / Math.PI;
  };

  return Promise.all([getUsersList, getUserCoords]).then(results => {
    const usersList = results[0].val();
    const userCoords = results[1].val();
    let nearbyArray = [];

    for(let u in usersList) {
      if(usersList[u].coords) {
        let distance = ( 6371 * Math.acos( Math.cos( radians(userCoords.lat) ) * Math.cos( radians( usersList[u].coords.lat ) ) * Math.cos( radians( usersList[u].coords.lon ) - radians(userCoords.lon) ) + Math.sin( radians(userCoords.lat) ) * Math.sin(radians(usersList[u].coords.lat)) ) );
        console.log(distance);

        if(distance <= 3) {
          if(userId != u) {
            nearbyArray.push({
              id: u,
              distance: distance,
              model: usersList[u].model,
              color: usersList[u].color,
              nr: usersList[u].nr,
              token: usersList[u].token,
            });
          }
        }

        admin.database().ref(`/users/${userId}/nearby`).set(nearbyArray);
      }
    }

    // console.log(JSON.stringify(usersList.val()));
    // console.log(JSON.stringify(userCoords.val()));
  });
});

exports.sendVoiceNotification = functions.database.ref('/voices/{timestamp}').onWrite(event => {
  const timestamp = event.params.timestamp;
  // If un-follow we exit the function.


  // Get the list of device notification tokens.
  const getDeviceTokensPromise = admin.database().ref(`/voices/${timestamp}/to`).once('value');

  const getSenderToken = admin.database().ref(`/voices/${timestamp}/from`).once('value');

  return Promise.all([getDeviceTokensPromise, getSenderToken]).then(results => {
    const tokensSnapshot = results[0];
    const sender = results[1];


    // Check if there are any device tokens.
    if (!tokensSnapshot.hasChildren()) {
      return console.log('There are no notification tokens to send to.');
    }
    console.log('There are', tokensSnapshot.numChildren(), 'tokens to send notifications to.');
    console.log('Fetched follower profile', sender);

    // const getMsg = admin.database().ref(`/flags/${msgFlag}`).once('value');

    // const getSenderInfo = admin.database().ref(`/users/${sender}/nr`).once('value');

    // Notification details.
    const payload = {
      notification: {
        title: `CarCare`,
        body: `Nowa wiadomość głosowa`,
        tag: `${timestamp}`,
      }
    };

    // Listing all tokens.
    let tokens = [];

    for(let key in tokensSnapshot.val()) {
      tokens.push(tokensSnapshot.val()[key]);
    }

    // Send notifications to all tokens.
    return admin.messaging().sendToDevice(tokens, payload).then(response => {
      // For each message check if there was an error.
      const tokensToRemove = [];
      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          console.error('Failure sending notification to', tokens[index], error);
          // Cleanup the tokens who are not registered anymore.
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
            tokensToRemove.push(tokensSnapshot.ref.child(tokens[index]).remove());
          }
        }
      });
      return Promise.all(tokensToRemove);
    });
  });
});
