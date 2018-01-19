/**
 * For operating user controls
 */
"use strict";
window._Controls = function (el) {
  // whether to console debug
  const dbg = false;

  // The display context
  const ctx = el.getContext("2d");
  
  // The body element
  const body = document.getElementsByTagName('body')[0];

  // The socket transporter
  const socket = io.connect('/controls');

  // A vibration wrapper
  const Vibe = function (vibeTime) {
    if (window.navigator && window.navigator.vibrate) {
      // Shake that device!
      navigator.vibrate(vibeTime);
    }
  };

  // touch copier makes all touches have the same profile
  const CopyTouch = touch => {
    dbg && console.log('touch: ', touch);
    return {
      // by using which as the default, mouse buttons are correctly profiled with an identifier
      identifier: touch.which >= 0 ? touch.which : touch.identifier,
      pageX: touch.pageX,
      pageY: touch.pageY,
      force: touch.force || 0,
      radiusX: touch.radiusX || 0,
      radiusY: touch.radiusY || 0};
  };

  // Assign a color to each touch
  const ColorForTouch = touch => !touch || isNaN(touch.identifier) ? '#111' : '#' +
    (touch.identifier % 16).toString(16) +
    (Math.floor(touch.identifier / 3) % 16).toString(16) + 
    (Math.floor(touch.identifier / 7) % 16).toString(16);

  // Draw a touch event
  const DrawTouch = touch => {
    ctx.beginPath();
    ctx.arc(touch.pageX, touch.pageY, touch.force ? touch.force * 50 : 10, 0, 2 * Math.PI, false);  // a circle at the start
    ctx.fillStyle = ColorForTouch(touch);
    ctx.fill();
  };

  // Draw a move event
  const DrawMove = (touch, idx) => {
    ctx.beginPath();
    dbg && console.log("ctx.moveTo(" + ongoingTouches[idx].pageX + ", " + ongoingTouches[idx].pageY + ");");
    ctx.moveTo(ongoingTouches[idx].pageX, ongoingTouches[idx].pageY);
    dbg && console.log("ctx.lineTo(" + touch.pageX + ", " + touch.pageY + ");");
    ctx.lineTo(touch.pageX, touch.pageY);
    ctx.lineWidth = touch.force ? touch.force * 15 : 4;
    ctx.strokeStyle = ColorForTouch(touch);
    ctx.stroke();
  };

  // Get the index of the specified touch in ongoingTouches
  const OngoingTouchIndexById = (idToFind)  => {
    for (let i = 0; i < ongoingTouches.length; i++) {
      if (ongoingTouches[i].identifier == idToFind) {
        return i;
      }
    }
    return -1;    // not found
  };

  // Send the touches to the server
  const SendTouches = fields => {
    let g = document.getElementsByTagName('body')[0];
    socket.emit('control', Object.assign({}, fields, {
      touches: ongoingTouches,
      screen: {
        width: window.outerWidth || el.clientWidth || g.clientWidth,
        height: window.outerHeight|| el.clientHeight|| g.clientHeight
      }
    }));
  };

  const fadeOut = () => {
    ctx.fillStyle = "rgba(50,50,50,0.05)";
    ctx.fillRect(0, 0, el.width, el.height);
    setTimeout(fadeOut,100);
  };


  /**
   * These event listeners will be attached to the event they are named after
   */
  const listeners = {
    touchstart: evt => {
      // evt.preventDefault();
      let touches = evt.changedTouches;
      // fill the screen with the canvas on first touch
      if (screenfull.enabled)
        screenfull.request();
  
      // Debug the touches
      Object.keys(touches).forEach(touchId => {
        ongoingTouches.push(CopyTouch(touches[touchId]));
        DrawTouch(touches[touchId]);
        Vibe(touches[touchId].force ? touches[touchId].force / 2 : 1)
      });

      SendTouches({type: 'touchstart'});
    },

    touchend: evt => {
      evt.preventDefault();
      let touches = evt.changedTouches;

      Object.keys(touches).forEach(touchId => {
        let idx = OngoingTouchIndexById(touches[touchId].identifier);
        if (idx >= 0)
          ongoingTouches.splice(idx, 1);  // remove it; we're done

        Vibe(touches[touchId].force ? touches[touchId].force / 5 : .2)
      });

      SendTouches({type: 'touchend'});
    },

    touchcancel: evt => {
      evt.preventDefault();
      let touches = evt.changedTouches;
      touches && touches.length && touches.forEach(touch => ongoingTouches.splice(OngoingTouchIndexById(touch.identifier), 1));
      SendTouches({type: 'touchcancel'});
    },

    touchmove: evt => {
      evt.preventDefault();
      let touches = evt.changedTouches;
      Object.keys(touches).forEach(touchId => {
        let idx = OngoingTouchIndexById(touches[touchId].identifier);
        if (idx >= 0) {
          // Draw the line
          DrawMove(touches[touchId], idx);
          // swap in the new touch record
          ongoingTouches.splice(idx, 1, CopyTouch(touches[touchId]));          
        }
      });
      SendTouches({type: 'touchmove'});
    },

    mousedown: evt => {
      evt.preventDefault();
      let touch = CopyTouch(evt);
      let idx = OngoingTouchIndexById(touch.identifier);
      if (idx >= 0) {
        ongoingTouches.splice(idx, 1, touch);
      } else {
        ongoingTouches.push(touch)
      }
      DrawTouch(touch)
      SendTouches({type: 'mousedown'});
    },

    mouseup: evt => {
      evt.preventDefault();
      let touch = CopyTouch(evt);
      let idx = OngoingTouchIndexById(touch.identifier);
      if (idx >= 0) {
        ongoingTouches.splice(idx, 1);
        SendTouches({type: 'mouseup'});
      }
    },

    mousemove: evt => {
      evt.preventDefault();
      let touch = CopyTouch(evt);
      let idx = OngoingTouchIndexById(touch.identifier);
      if (idx >= 0) {
        // Draw the line
        DrawMove(touch, idx);
        ongoingTouches.splice(idx, 1, touch);
        SendTouches({type: 'mousemove'});
      }
    }
  };

  // Records the current touch profile
  let ongoingTouches = [];

  // records the current tilt profile
  let tilt = null;

  
  if (el) {

    el.setAttribute('width', window.outerWidth + 'px');
    el.setAttribute('height', window.outerHeight + 'px');

    // monitor for all listener events and send them as they happen
    Object.keys(listeners).forEach(listener => el.addEventListener(listener, listeners[listener]));
  }

  // Subscribe to server side events (not yet used)
  socket.on('event', data => dbg && console.log('player event data: ', data));

  //@todo monitor for all tilt events and send them as they happen
  fadeOut();

};

// Execute the Controls function with an argument of the DOM element to monitor
_Controls(document.getElementById('body-ctx'));