// A global callback for youtube... that makes me angry
var onYouTubePlayerReady = function( containerId ) {

  onYouTubePlayerReady[ containerId ] && onYouTubePlayerReady[ containerId ]();
};
onYouTubePlayerReady.stateChangeEventHandler = {};
onYouTubePlayerReady.onErrorEventHandler = {};

Popcorn.player( "youtube", {
  _canPlayType: function( nodeName, url ) {

    return (/(?:http:\/\/www\.|http:\/\/|www\.|\.|^)(youtu)/).test( url ) && nodeName.toLowerCase() !== "video";
  },
  _setup: function( options ) {

    var media = this,
        autoPlay = false,
        container = document.createElement( "div" ),
        currentTime = 0,
        paused = true,
        firstGo = true,

        // state code for volume changed polling
        lastMuted = false,
        lastVolume = 100;

    container.id = media.id + Popcorn.guid();

    options._container = container;

    media.appendChild( container );

    var youtubeInit = function() {

      var flashvars, params, attributes, src, width, height, query,
          playerQueue = Popcorn.player.playerQueue();

      // expose a callback to this scope, that is called from the global callback youtube calls
      onYouTubePlayerReady[ container.id ] = function() {

        options.youtubeObject = document.getElementById( container.id );

        // more youtube callback nonsense
        onYouTubePlayerReady.stateChangeEventHandler[ container.id ] = function( state ) {

          if ( options.destroyed ) {

            return;
          }

          // youtube fires paused events while seeking
          // this is the only way to get seeking events
          if ( state === 2 ) {

            paused = true;
            media.dispatchEvent( "pause" );
            playerQueue.next();

            return;
          } else
          // playing is state 1
          // paused is state 2
          if ( state === 1 && !firstGo ) {

            paused = false;
            media.dispatchEvent( "play" );
            media.dispatchEvent( "playing" );
            timeupdate();
            playerQueue.next();
            return;
          } else
          // this is the real player ready check
          // -1 is for unstarted, but ready to go videos
          // before this the player object exists, but calls to it may go unheard
          if ( state === -1 ) {

            options.youtubeObject.playVideo();
            return;
          } else if ( state === 1 && firstGo ) {

            options.youtubeObject.pauseVideo();
            firstGo = false;

            // pulling initial volume states form baseplayer
            lastVolume = media.volume;
            lastMuted = media.muted;

            // pulling initial paused state from autoplay or the baseplayer
            // also need to explicitly set to paused otherwise.
            if ( autoPlay || !media.paused ) {
              media.play();
            } else {
              media.pause();
            }

            media.duration = options.youtubeObject.getDuration();

            media.dispatchEvent( "durationchange" );
            volumeupdate();

            // this syncs because of changes done to youtube via fragments
            media.currentTime = options.youtubeObject.getCurrentTime();

            createProperties();
            media.dispatchEvent( "loadedmetadata" );
            media.dispatchEvent( "loadeddata" );

            media.readyState = 4;
            media.dispatchEvent( "canplaythrough" );

            return;
          } else if ( state === 0 ) {
            media.dispatchEvent( "ended" );
          }
        };

        onYouTubePlayerReady.onErrorEventHandler[ container.id ] = function( errorCode ) {
          if ( [ 2, 100, 101, 150 ].indexOf( errorCode ) !== -1 ) {
            media.error = {
              customCode: errorCode
            };
            media.dispatchEvent( "error" );
          }
        };

        // youtube requires callbacks to be a string to a function path from the global scope
        options.youtubeObject.addEventListener( "onStateChange", "onYouTubePlayerReady.stateChangeEventHandler." + container.id );

        options.youtubeObject.addEventListener( "onError", "onYouTubePlayerReady.onErrorEventHandler." + container.id );

        var timeupdate = function() {

          if ( options.destroyed ) {

            return;
          }

          if ( !paused ) {

            currentTime = options.youtubeObject.getCurrentTime();
            media.dispatchEvent( "timeupdate" );
            setTimeout( timeupdate, 10 );
          }
        };

        var volumeupdate = function() {

          if ( options.destroyed ) {

            return;
          }

          if ( lastMuted !== options.youtubeObject.isMuted() ) {

            lastMuted = options.youtubeObject.isMuted();
            media.dispatchEvent( "volumechange" );
          }

          if ( lastVolume !== options.youtubeObject.getVolume() ) {

            lastVolume = options.youtubeObject.getVolume();
            media.dispatchEvent( "volumechange" );
          }

          setTimeout( volumeupdate, 250 );
        };

        media.play = function() {

          if ( options.destroyed ) {

            return;
          }

          paused = false;
          playerQueue.add(function() {

            if ( options.youtubeObject.getPlayerState() !== 1 ) {

              options.youtubeObject.playVideo();
            } else {
              playerQueue.next();
            }
          });
        };

        media.pause = function() {

          if ( options.destroyed ) {

            return;
          }

          paused = true;
          playerQueue.add(function() {

            if ( options.youtubeObject.getPlayerState() !== 2 ) {

              options.youtubeObject.pauseVideo();
            } else {
              playerQueue.next();
            }
          });
        };

        Popcorn.player.defineProperty( media, "currentTime", {
          set: function( val ) {

            // make sure val is a number
            currentTime = +val;

            if ( options.destroyed ) {

              return currentTime;
            }

            media.dispatchEvent( "seeked" );
            media.dispatchEvent( "timeupdate" );

            options.youtubeObject.seekTo( currentTime );

            return currentTime;
          },
          get: function() {

            return currentTime;
          }
        });

        Popcorn.player.defineProperty( media, "paused", {
          get: function() {

            return paused;
          }
        });

        Popcorn.player.defineProperty( media, "muted", {
          set: function( val ) {

            if ( options.destroyed ) {

              return val;
            }

            if ( options.youtubeObject.isMuted() !== val ) {

              if ( val ) {

                options.youtubeObject.mute();
              } else {

                options.youtubeObject.unMute();
              }

              lastMuted = options.youtubeObject.isMuted();
              media.dispatchEvent( "volumechange" );
            }

            return options.youtubeObject.isMuted();
          },
          get: function() {

            if ( options.destroyed ) {

              return 0;
            }

            return options.youtubeObject.isMuted();
          }
        });

        Popcorn.player.defineProperty( media, "volume", {
          set: function( val ) {

            if ( options.destroyed ) {

              return val;
            }

            if ( options.youtubeObject.getVolume() / 100 !== val ) {

              options.youtubeObject.setVolume( val * 100 );
              lastVolume = options.youtubeObject.getVolume();
              media.dispatchEvent( "volumechange" );
            }

            return options.youtubeObject.getVolume() / 100;
          },
          get: function() {

            if ( options.destroyed ) {

              return 0;
            }

            return options.youtubeObject.getVolume() / 100;
          }
        });
      };

      options.controls = +options.controls === 0 || +options.controls === 1 ? options.controls : 1;
      options.annotations = +options.annotations === 1 || +options.annotations === 3 ? options.annotations : 1;

      flashvars = {
        playerapiid: container.id
      };

      params = {
        wmode: "transparent",
        allowScriptAccess: "always"
      };

      src = /^.*(?:\/|v=)(.{11})/.exec( media.src )[ 1 ];

      query = ( media.src.split( "?" )[ 1 ] || "" )
                         .replace( /v=.{11}/, "" );
      query = query.replace( /&t=(?:(\d+)m)?(?:(\d+)s)?/, function( all, minutes, seconds ) {

        // Make sure we have real zeros
        minutes = minutes | 0; // bit-wise OR
        seconds = seconds | 0; // bit-wise OR

        return "&start=" + ( +seconds + ( minutes * 60 ) );
      });

      autoPlay = ( /autoplay=1/.test( query ) );

      // setting youtube player's height and width, default to 560 x 315
      width = media.style.width ? "" + media.offsetWidth : "560";
      height = media.style.height ? "" + media.offsetHeight : "315";

      attributes = {
        id: container.id,
        "data-youtube-player": "//www.youtube.com/e/" + src + "?" + query + "&enablejsapi=1&playerapiid=" + container.id + "&version=3"
      };

      swfobject.embedSWF( attributes[ "data-youtube-player" ], container.id, width, height, "8", undefined, flashvars, params, attributes );
    };

    if ( !window.swfobject ) {

      Popcorn.getScript( "//ajax.googleapis.com/ajax/libs/swfobject/2.2/swfobject.js", youtubeInit );
    } else {

      youtubeInit();
    }
  },
  _teardown: function( options ) {

    options.destroyed = true;

    var youtubeObject = options.youtubeObject;
    if( youtubeObject ){
      youtubeObject.stopVideo();
      youtubeObject.clearVideo();
    }

    this.removeChild( document.getElementById( options._container.id ) );
  }
});
