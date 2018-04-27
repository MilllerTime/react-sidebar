import React from 'react';
import PropTypes from 'prop-types';

// Default animation duration (in seconds)
const DURATION = 0.3;
// The distance sidebar must be dragged to show intent of opening/closing
const DRAG_INTENT_DISTANCE = 24;
// Number of touch points to average for drag velocity calculation
// Must be at least 2 in order to compute a delta, higher values smooth out velocity readings
const TOUCH_COUNT = 4;

const defaultStyles = {
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
    transitionDuration: `${DURATION}s`,
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
    transitionDuration: `${DURATION}s`,
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

class Sidebar extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
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
    this.touchPositions = [];

    // Transition duration override with expiry time. Set in onTouchEnd handler.
    // Render method will check this, but it's not needed for rendering.
    this.durationOverride = null;

    // Bind instance methods
    this.overlayClicked = this.overlayClicked.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
  }

  componentDidMount() {
    this.setState({
      dragSupported: typeof window === 'object' && 'ontouchstart' in window
    });
  }

  onTouchStart(ev) {
    // filter out if a user starts swiping with a second finger
    if (!this.isTouching()) {
      const touch = ev.targetTouches[0];
      const currentX = touch.clientX;
      const currentY = touch.clientY;
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

  onTouchMove(ev) {
    if (this.isTouching()) {
      for (let ind = ev.targetTouches.length - 1; ind >= 0; ind--) {
        const touch = ev.targetTouches[ind];
        // we only care about the finger that we are tracking
        if (touch.identifier === this.state.touchIdentifier) {
          const currentX = touch.clientX;
          const currentY = touch.clientY;

          const nextState = {
            touchCurrentX: currentX,
            touchCurrentY: currentY
          };

          this.touchPositions.push({ x: currentX, time: Date.now() });
          if (this.touchPositions.length > TOUCH_COUNT) {
            this.touchPositions.shift();
          }

          const deltaX = Math.abs(currentX - this.state.touchStartX);
          const deltaY = Math.abs(currentY - this.state.touchStartY);

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

  onTouchEnd() {
    if (this.isTouching()) {
      // trigger a change to open if sidebar has been dragged beyond dragToggleDistance
      const touchWidth = this.touchSidebarWidth();

      if (this.props.open && touchWidth < this.props.width - this.props.dragToggleDistance ||
          !this.props.open && touchWidth > this.props.dragToggleDistance)
      {
        // Compute velocity (px/s)
        const velocity = this.dragVelocity();
        // Determine open state from velocity
        const shouldOpen = this.props.pullRight ? velocity < 0 : velocity > 0;
        if (this.props.open !== shouldOpen) {
          this.props.onSetOpen(shouldOpen);
        }

        // Derive speed from velocity and compute override transition duration if needed
        // This will give a feeling of momentum when quickly flicking drawer
        const speed = Math.abs(velocity);
        const minSpeed = 500;
        const maxSpeed = 2000;
        const minDuration = 0.1; // seconds
        if (speed > minSpeed) {
          const adjustedSpeed = Math.min(maxSpeed, speed) - minSpeed;
          const multiplier = 1 - adjustedSpeed / (maxSpeed - minSpeed);
          const scaledDuration = Math.max(minDuration, DURATION * multiplier);
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

  isTouching() {
    return this.state.touchIdentifier !== null;
  }

  overlayClicked() {
    if (this.props.open) {
      this.props.onSetOpen(false);
    }
  }

  // calculate the sidebarWidth based on current touch info
  touchSidebarWidth() {
    // if the sidebar is open and start point of drag is inside the sidebar
    // we will only drag the distance they moved their finger
    // otherwise we will move the sidebar to be below the finger.

    const { pullRight, open, width } = this.props;
    const { touchStartX, touchCurrentX } = this.state;

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
  dragVelocity() {
    const deltaCount = this.touchPositions.length - 1;
    if (deltaCount < 1) {
      return 0;
    }

    let velocitySum = 0;
    // Don't loop to zero, as we'll always be comparing the current index to the previous
    for (let i = deltaCount; i > 0; i--) {
      const curr = this.touchPositions[i];
      const last = this.touchPositions[i-1];
      velocitySum += (curr.x - last.x) / ((curr.time - last.time) / 1000);
    }

    return velocitySum / deltaCount;
  }

  render() {
    const sidebarStyle = {...defaultStyles.sidebar, ...this.props.styles.sidebar};
    const overlayStyle = {...defaultStyles.overlay, ...this.props.styles.overlay};
    const useTouch = this.state.dragSupported && this.props.touch;
    const isTouching = this.isTouching();
    const rootProps = {
      className: this.props.rootClassName,
      style: {...defaultStyles.root, ...this.props.styles.root}
    };
    let dragHandle;

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
    }
    else {
      rootProps.style.left = 0;
      sidebarStyle.left = 0;
      sidebarStyle.transform = 'translate3d(-100%, 0, 0)';
      sidebarStyle.WebkitTransform = 'translate3d(-100%, 0, 0)';
      if (this.props.shadow) {
        sidebarStyle.boxShadow = '4px 0px 24px rgba(0, 0, 0, 0.16)';
      }
    }

    if (isTouching) {
      const percentage = this.touchSidebarWidth() / this.props.width;

      // slide open to what we dragged (and ensure visibility)
      sidebarStyle.visibility = 'visible';
      if (this.props.pullRight) {
        sidebarStyle.transform = `translate3d(${(1 - percentage) * 100}%, 0, 0)`;
        sidebarStyle.WebkitTransform = `translate3d(${(1 - percentage) * 100}%, 0, 0)`;
      }
      else {
        sidebarStyle.transform = `translate3d(-${(1 - percentage) * 100}%, 0, 0)`;
        sidebarStyle.WebkitTransform = `translate3d(-${(1 - percentage) * 100}%, 0, 0)`;
      }

      // fade overlay to match distance of drag
      overlayStyle.opacity = percentage;
      overlayStyle.visibility = 'visible';
    }
    else if (this.props.open) {
      // slide open sidebar
      sidebarStyle.visibility = 'visible';
      sidebarStyle.transform = `translate3d(0%, 0, 0)`;
      sidebarStyle.WebkitTransform = `translate3d(0%, 0, 0)`;

      // show overlay
      overlayStyle.opacity = 1;
      overlayStyle.visibility = 'visible';
    }

    if (isTouching || !this.props.transitions) {
      sidebarStyle.transitionProperty =
        sidebarStyle.WebkitTransitionProperty =
        overlayStyle.transitionProperty = 'none';
    }

    if (this.durationOverride && this.durationOverride.expiry >= Date.now()) {
      sidebarStyle.transitionDuration =
        overlayStyle.transitionDuration = this.durationOverride.duration + 's';
    }

    if (useTouch) {
      if (this.props.open) {
        rootProps.onTouchStart = this.onTouchStart;
        rootProps.onTouchMove = this.onTouchMove;
        rootProps.onTouchEnd = this.onTouchEnd;
        rootProps.onTouchCancel = this.onTouchEnd;
      }
      else {
        const dragHandleStyle = {...defaultStyles.dragHandle, ...this.props.styles.dragHandle};
        dragHandleStyle.width = this.props.touchHandleWidth;

        // dragHandleStyle right/left
        if (this.props.pullRight) {
          dragHandleStyle.right = 0;
        }
        else {
          dragHandleStyle.left = 0;
        }

        dragHandle = (
          <div style={dragHandleStyle}
               onTouchStart={this.onTouchStart} onTouchMove={this.onTouchMove}
               onTouchEnd={this.onTouchEnd} onTouchCancel={this.onTouchEnd} />);
      }
    }

    return (
      <div {...rootProps}>
        <div className={this.props.sidebarClassName} style={sidebarStyle}>
          {this.props.sidebar}
        </div>
        <div className={this.props.overlayClassName}
             style={overlayStyle}
             role="presentation"
             tabIndex="0"
             onClick={this.overlayClicked}
          />
        {dragHandle}
      </div>
    );
  }
}

Sidebar.propTypes = {
  // styles
  styles: PropTypes.shape({
    root: PropTypes.object,
    sidebar: PropTypes.object,
    overlay: PropTypes.object,
    dragHandle: PropTypes.object
  }),

  // root component optional class
  rootClassName: PropTypes.string,

  // sidebar optional class
  sidebarClassName: PropTypes.string,

  // overlay optional class
  overlayClassName: PropTypes.string,

  // sidebar content to render
  sidebar: PropTypes.node.isRequired,

  // width of sidebar
  width: PropTypes.number,

  // boolean if sidebar should slide open
  open: PropTypes.bool,

  // boolean if transitions should be disabled
  transitions: PropTypes.bool,

  // boolean if touch gestures are enabled
  touch: PropTypes.bool,

  // max distance from the edge we can start touching
  touchHandleWidth: PropTypes.number,

  // Place the sidebar on the right
  pullRight: PropTypes.bool,

  // Enable/Disable sidebar shadow
  shadow: PropTypes.bool,

  // distance we have to drag the sidebar to toggle open state
  dragToggleDistance: PropTypes.number,

  // callback called when the overlay is clicked
  onSetOpen: PropTypes.func
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
  onSetOpen: () => {},
  styles: {}
};

export default Sidebar;
