import React from 'react';

const DRAG_INTENT_DISTANCE = 24;

const defaultStyles = {
  root: {
    zIndex: 1000,
    position: 'absolute',
    top: 0
  },
  sidebar: {
    zIndex: 2,
    position: 'fixed',
    WebkitOverflowScrolling: 'touch',
    top: 0,
    bottom: 0,
    visibility: 'hidden',
    transition: 'transform .3s ease-out, visibility .3s ease-out',
    WebkitTransition: '-webkit-transform .3s ease-out, visibility .3s ease-out',
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
    transition: 'opacity .3s ease-out, visibility .3s ease-out',
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
      this.setState({
        touchIdentifier: touch.identifier,
        touchStartX: touch.clientX,
        touchStartY: touch.clientY,
        touchCurrentX: touch.clientX,
        touchCurrentY: touch.clientY
      });
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
          !this.props.open && touchWidth > this.props.dragToggleDistance) {
        this.props.onSetOpen(!this.props.open);
      }

      this.setState({
        touchIdentifier: null,
        touchStartX: null,
        touchStartY: null,
        touchCurrentX: null,
        touchCurrentY: null,
        dragLock: false
      });
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
    if (!this.props.open) {
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
      sidebarStyle.transition = 'none';
      sidebarStyle.WebkitTransition = 'none';
      overlayStyle.transition = 'none';
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
  styles: React.PropTypes.shape({
    root: React.PropTypes.object,
    sidebar: React.PropTypes.object,
    overlay: React.PropTypes.object,
    dragHandle: React.PropTypes.object
  }),

  // root component optional class
  rootClassName: React.PropTypes.string,

  // sidebar optional class
  sidebarClassName: React.PropTypes.string,

  // overlay optional class
  overlayClassName: React.PropTypes.string,

  // sidebar content to render
  sidebar: React.PropTypes.node.isRequired,

  // width of sidebar
  width: React.PropTypes.number,

  // boolean if sidebar should slide open
  open: React.PropTypes.bool,

  // boolean if transitions should be disabled
  transitions: React.PropTypes.bool,

  // boolean if touch gestures are enabled
  touch: React.PropTypes.bool,

  // max distance from the edge we can start touching
  touchHandleWidth: React.PropTypes.number,

  // Place the sidebar on the right
  pullRight: React.PropTypes.bool,

  // Enable/Disable sidebar shadow
  shadow: React.PropTypes.bool,

  // distance we have to drag the sidebar to toggle open state
  dragToggleDistance: React.PropTypes.number,

  // callback called when the overlay is clicked
  onSetOpen: React.PropTypes.func
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
