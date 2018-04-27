'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// Default animation duration (in seconds)
var DURATION = 0.3;
// The distance sidebar must be dragged to show intent of opening/closing
var DRAG_INTENT_DISTANCE = 24;
// Number of touch points to average for drag velocity calculation
// Must be at least 2 in order to compute a delta, higher values smooth out velocity readings
var TOUCH_COUNT = 4;

var defaultStyles = {
  root: {
    zIndex: 1000,
    position: 'absolute',
    top: 0,
    // Adding `touchAction: none` to the `root` is a hack to disable scrolling for Chrome on Android.
    // We used to just call `event.preventDefault()` in the `touchmove` handler while dragging, but Chrome's
    // default passive events no longer allow that. This hack works because in `render` we use
    // `pointerEvents: none` to allow touches to pass through to the app when the drawer is inactive.
    // So `touchAction` has no effect until the drawer is opened or user is dragging it, per that logic.
    // The downside is that vertical swipes on the drag handle don't trigger scrolling, even through we cancel
    // the drag due to the vertical gesture.
    //
    // Removing this `touchAction` property and using `event.preventDefault()`
    // is ideal, as soon as we can declaratively bind non-passive touch events with React.
    //
    // There is a tracking issue: https://github.com/facebook/react/issues/6436
    touchAction: 'none'
  },
  sidebar: {
    zIndex: 2,
    position: 'fixed',
    WebkitOverflowScrolling: 'touch',
    top: 0,
    bottom: 0,
    visibility: 'hidden',
    transitionProperty: 'transform, visibility',
    WebkitTransitionProperty: '-webkit-transform, visibility',
    transitionDuration: DURATION + 's',
    transitionTimingFunction: 'ease-out',
    willChange: 'transform',
    overflowY: 'auto'
  },
  overlay: {
    zIndex: 1,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    visibility: 'hidden',
    transitionProperty: 'opacity, visibility',
    transitionDuration: DURATION + 's',
    transitionTimingFunction: 'ease-out',
    willChange: 'opacity',
    backgroundColor: 'rgba(0,0,0,.3)'
  },
  dragHandle: {
    zIndex: 1,
    position: 'fixed',
    top: 0,
    bottom: 0
  }
};

var Sidebar = function (_React$Component) {
  _inherits(Sidebar, _React$Component);

  function Sidebar(props) {
    _classCallCheck(this, Sidebar);

    var _this = _possibleConstructorReturn(this, (Sidebar.__proto__ || Object.getPrototypeOf(Sidebar)).call(this, props));

    _this.state = {
      // keep track of touching params
      touchIdentifier: null,
      touchStartX: null,
      touchStartY: null,
      touchCurrentX: null,
      touchCurrentY: null,

      // whether sidebar dragging action should override other touch actions
      dragLock: false,

      // if touch is supported by the browser
      dragSupported: false
    };

    // Track touch positions over time (isn't used for rendering, doesn't need to be in state)
    // Always reset on touch end.
    // Array will contain objects of format { x:int, time:int } where `x` is a pixel coordinate,
    // and `time` is the ms since last movement.
    _this.touchPositions = [];

    // Transition duration override with expiry time. Set in onTouchEnd handler.
    // Render method will check this, but it's not needed for rendering.
    _this.durationOverride = null;

    // Bind instance methods
    _this.overlayClicked = _this.overlayClicked.bind(_this);
    _this.onTouchStart = _this.onTouchStart.bind(_this);
    _this.onTouchMove = _this.onTouchMove.bind(_this);
    _this.onTouchEnd = _this.onTouchEnd.bind(_this);
    return _this;
  }

  _createClass(Sidebar, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      this.setState({
        dragSupported: (typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && 'ontouchstart' in window
      });
    }
  }, {
    key: 'onTouchStart',
    value: function onTouchStart(ev) {
      // filter out if a user starts swiping with a second finger
      if (!this.isTouching()) {
        var touch = ev.targetTouches[0];
        var currentX = touch.clientX;
        var currentY = touch.clientY;
        this.setState({
          touchIdentifier: touch.identifier,
          touchStartX: currentX,
          touchStartY: currentY,
          touchCurrentX: currentX,
          touchCurrentY: currentY
        });

        this.touchPositions.push({ x: currentX, time: Date.now() });
      }
    }
  }, {
    key: 'onTouchMove',
    value: function onTouchMove(ev) {
      if (this.isTouching()) {
        for (var ind = ev.targetTouches.length - 1; ind >= 0; ind--) {
          var touch = ev.targetTouches[ind];
          // we only care about the finger that we are tracking
          if (touch.identifier === this.state.touchIdentifier) {
            var currentX = touch.clientX;
            var currentY = touch.clientY;

            var nextState = {
              touchCurrentX: currentX,
              touchCurrentY: currentY
            };

            this.touchPositions.push({ x: currentX, time: Date.now() });
            if (this.touchPositions.length > TOUCH_COUNT) {
              this.touchPositions.shift();
            }

            var deltaX = Math.abs(currentX - this.state.touchStartX);
            var deltaY = Math.abs(currentY - this.state.touchStartY);

            // If user drags sidebar far enough horizontally without as much vertical movement, we'll "lock" the drag
            if (deltaX >= DRAG_INTENT_DISTANCE && deltaX >= deltaY) {
              nextState.dragLock = true;
            }
            // If user drags too far vertically, we'll cancel the drag
            else if (!this.state.dragLock && deltaY >= DRAG_INTENT_DISTANCE) {
                this.onTouchEnd();
                break;
              }

            // If drag was previously locked, prevent touch movement from doing other things (like scrolling)
            if (this.state.dragLock) {
              ev.preventDefault();
            }

            this.setState(nextState);
            break;
          }
        }
      }
    }
  }, {
    key: 'onTouchEnd',
    value: function onTouchEnd() {
      if (this.isTouching()) {
        // trigger a change to open if sidebar has been dragged beyond dragToggleDistance
        var touchWidth = this.touchSidebarWidth();

        if (this.props.open && touchWidth < this.props.width - this.props.dragToggleDistance || !this.props.open && touchWidth > this.props.dragToggleDistance) {
          // Compute velocity (px/s)
          var velocity = this.dragVelocity();
          // Determine open state from velocity
          var shouldOpen = this.props.pullRight ? velocity < 0 : velocity > 0;
          if (this.props.open !== shouldOpen) {
            this.props.onSetOpen(shouldOpen);
          }

          // Derive speed from velocity and compute override transition duration if needed
          // This will give a feeling of momentum when quickly flicking drawer
          var speed = Math.abs(velocity);
          var minSpeed = 500;
          var maxSpeed = 2000;
          var minDuration = 0.1; // seconds
          if (speed > minSpeed) {
            var adjustedSpeed = Math.min(maxSpeed, speed) - minSpeed;
            var multiplier = 1 - adjustedSpeed / (maxSpeed - minSpeed);
            var scaledDuration = Math.max(minDuration, DURATION * multiplier);
            this.durationOverride = {
              duration: scaledDuration,
              // Duration override should only be effective as long as transition lasts
              expiry: Date.now() + scaledDuration * 1000
            };
          }
        }

        this.setState({
          touchIdentifier: null,
          touchStartX: null,
          touchStartY: null,
          touchCurrentX: null,
          touchCurrentY: null,
          dragLock: false,
          dragVelocity: 0
        });

        this.touchPositions = [];
      }
    }
  }, {
    key: 'isTouching',
    value: function isTouching() {
      return this.state.touchIdentifier !== null;
    }
  }, {
    key: 'overlayClicked',
    value: function overlayClicked() {
      if (this.props.open) {
        this.props.onSetOpen(false);
      }
    }

    // calculate the sidebarWidth based on current touch info

  }, {
    key: 'touchSidebarWidth',
    value: function touchSidebarWidth() {
      // if the sidebar is open and start point of drag is inside the sidebar
      // we will only drag the distance they moved their finger
      // otherwise we will move the sidebar to be below the finger.

      var _props = this.props,
          pullRight = _props.pullRight,
          open = _props.open,
          width = _props.width;
      var _state = this.state,
          touchStartX = _state.touchStartX,
          touchCurrentX = _state.touchCurrentX;


      if (pullRight) {
        if (open && window.innerWidth - touchStartX < width) {
          if (touchCurrentX > touchStartX) {
            return width + touchStartX - touchCurrentX;
          }
          return width;
        }
        return Math.min(window.innerWidth - touchCurrentX, width);
      }

      if (open && touchStartX < width) {
        if (touchCurrentX > touchStartX) {
          return width;
        }
        return width - touchStartX + touchCurrentX;
      }
      return Math.min(touchCurrentX, width);
    }

    // calculate velocity of sidebar (based on touch data)
    // unit = pixels / second.

  }, {
    key: 'dragVelocity',
    value: function dragVelocity() {
      var deltaCount = this.touchPositions.length - 1;
      if (deltaCount < 1) {
        return 0;
      }

      var velocitySum = 0;
      // Don't loop to zero, as we'll always be comparing the current index to the previous
      for (var i = deltaCount; i > 0; i--) {
        var curr = this.touchPositions[i];
        var last = this.touchPositions[i - 1];
        velocitySum += (curr.x - last.x) / ((curr.time - last.time) / 1000);
      }

      return velocitySum / deltaCount;
    }
  }, {
    key: 'render',
    value: function render() {
      var sidebarStyle = _extends({}, defaultStyles.sidebar, this.props.styles.sidebar);
      var overlayStyle = _extends({}, defaultStyles.overlay, this.props.styles.overlay);
      var useTouch = this.state.dragSupported && this.props.touch;
      var isTouching = this.isTouching();
      var rootProps = {
        className: this.props.rootClassName,
        style: _extends({}, defaultStyles.root, this.props.styles.root)
      };
      var dragHandle = void 0;

      // enable/disable pointer events on overlay (when closed, events should pass through)
      // This has the effect of disabling scrolling once user has committed to dragging the sidebar, or the sidebar is open.
      if (!this.props.open && !this.state.dragLock) {
        overlayStyle.pointerEvents = 'none';
      }

      // sidebarStyle right/left
      if (this.props.pullRight) {
        rootProps.style.right = 0;
        sidebarStyle.right = 0;
        sidebarStyle.transform = 'translate3d(100%, 0, 0)';
        sidebarStyle.WebkitTransform = 'translate3d(100%, 0, 0)';
        if (this.props.shadow) {
          sidebarStyle.boxShadow = '-4px 0px 24px rgba(0, 0, 0, 0.16)';
        }
      } else {
        rootProps.style.left = 0;
        sidebarStyle.left = 0;
        sidebarStyle.transform = 'translate3d(-100%, 0, 0)';
        sidebarStyle.WebkitTransform = 'translate3d(-100%, 0, 0)';
        if (this.props.shadow) {
          sidebarStyle.boxShadow = '4px 0px 24px rgba(0, 0, 0, 0.16)';
        }
      }

      if (isTouching) {
        var percentage = this.touchSidebarWidth() / this.props.width;

        // slide open to what we dragged (and ensure visibility)
        sidebarStyle.visibility = 'visible';
        if (this.props.pullRight) {
          sidebarStyle.transform = 'translate3d(' + (1 - percentage) * 100 + '%, 0, 0)';
          sidebarStyle.WebkitTransform = 'translate3d(' + (1 - percentage) * 100 + '%, 0, 0)';
        } else {
          sidebarStyle.transform = 'translate3d(-' + (1 - percentage) * 100 + '%, 0, 0)';
          sidebarStyle.WebkitTransform = 'translate3d(-' + (1 - percentage) * 100 + '%, 0, 0)';
        }

        // fade overlay to match distance of drag
        overlayStyle.opacity = percentage;
        overlayStyle.visibility = 'visible';
      } else if (this.props.open) {
        // slide open sidebar
        sidebarStyle.visibility = 'visible';
        sidebarStyle.transform = 'translate3d(0%, 0, 0)';
        sidebarStyle.WebkitTransform = 'translate3d(0%, 0, 0)';

        // show overlay
        overlayStyle.opacity = 1;
        overlayStyle.visibility = 'visible';
      }

      if (isTouching || !this.props.transitions) {
        sidebarStyle.transitionProperty = sidebarStyle.WebkitTransitionProperty = overlayStyle.transitionProperty = 'none';
      }

      if (this.durationOverride && this.durationOverride.expiry >= Date.now()) {
        sidebarStyle.transitionDuration = overlayStyle.transitionDuration = this.durationOverride.duration + 's';
      }

      if (useTouch) {
        if (this.props.open) {
          rootProps.onTouchStart = this.onTouchStart;
          rootProps.onTouchMove = this.onTouchMove;
          rootProps.onTouchEnd = this.onTouchEnd;
          rootProps.onTouchCancel = this.onTouchEnd;
        } else {
          var dragHandleStyle = _extends({}, defaultStyles.dragHandle, this.props.styles.dragHandle);
          dragHandleStyle.width = this.props.touchHandleWidth;

          // dragHandleStyle right/left
          if (this.props.pullRight) {
            dragHandleStyle.right = 0;
          } else {
            dragHandleStyle.left = 0;
          }

          dragHandle = _react2.default.createElement('div', { style: dragHandleStyle,
            onTouchStart: this.onTouchStart, onTouchMove: this.onTouchMove,
            onTouchEnd: this.onTouchEnd, onTouchCancel: this.onTouchEnd });
        }
      }

      return _react2.default.createElement(
        'div',
        rootProps,
        _react2.default.createElement(
          'div',
          { className: this.props.sidebarClassName, style: sidebarStyle },
          this.props.sidebar
        ),
        _react2.default.createElement('div', { className: this.props.overlayClassName,
          style: overlayStyle,
          role: 'presentation',
          tabIndex: '0',
          onClick: this.overlayClicked
        }),
        dragHandle
      );
    }
  }]);

  return Sidebar;
}(_react2.default.Component);

Sidebar.propTypes = {
  // styles
  styles: _propTypes2.default.shape({
    root: _propTypes2.default.object,
    sidebar: _propTypes2.default.object,
    overlay: _propTypes2.default.object,
    dragHandle: _propTypes2.default.object
  }),

  // root component optional class
  rootClassName: _propTypes2.default.string,

  // sidebar optional class
  sidebarClassName: _propTypes2.default.string,

  // overlay optional class
  overlayClassName: _propTypes2.default.string,

  // sidebar content to render
  sidebar: _propTypes2.default.node.isRequired,

  // width of sidebar
  width: _propTypes2.default.number,

  // boolean if sidebar should slide open
  open: _propTypes2.default.bool,

  // boolean if transitions should be disabled
  transitions: _propTypes2.default.bool,

  // boolean if touch gestures are enabled
  touch: _propTypes2.default.bool,

  // max distance from the edge we can start touching
  touchHandleWidth: _propTypes2.default.number,

  // Place the sidebar on the right
  pullRight: _propTypes2.default.bool,

  // Enable/Disable sidebar shadow
  shadow: _propTypes2.default.bool,

  // distance we have to drag the sidebar to toggle open state
  dragToggleDistance: _propTypes2.default.number,

  // callback called when the overlay is clicked
  onSetOpen: _propTypes2.default.func
};

Sidebar.defaultProps = {
  width: 300,
  open: false,
  transitions: true,
  touch: true,
  touchHandleWidth: 20,
  pullRight: false,
  shadow: true,
  dragToggleDistance: 30,
  onSetOpen: function onSetOpen() {},
  styles: {}
};

exports.default = Sidebar;