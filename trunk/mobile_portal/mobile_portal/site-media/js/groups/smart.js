/************************************
 * (C) University of Oxford 2009    *
 * E-mail: erewhon AT oucs.ox.ac.uk *
 ************************************/



/************************************
 *           Geolocation            *
 ************************************/

var positionRequestCount = 0;
var positionWatchId = null;
var positionInterface = null;
var positionMethod = null;
var positionGeo = null;

function sendPosition(position, final) {
    if (positionRequestCount == 1)
        $('#location-status').html('Location found; please wait while we put a name to it.');
        
    jQuery.post(base+'update_location/', {
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
        accuracy: position.coords.accuracy,
        method: positionMethod,
        format: 'json',
    }, function(data) {
        accuracy = Math.round(position.coords.accuracy);
        $('.location').html(data);
        $('.location-status').html('We think you are somewhere near <span class="location">'+data['name']+'</span>.');

    }, 'json');
}

function sendPositionError(error) {
    if (error.code == error.PERMISSION_DENIED) {
        $('.location-status').html(
            'You did not give permission for the site to know your location. '
          + 'You won\'t be asked again unless you initiate an automatic '
          + 'update using the link below.');
        jQuery.post(base+'ajax/update_location/', {
            method: 'denied',
        });
    } else if (error.code == error.POSITION_UNAVAILABLE) {
        $('.location-status').html(
            'We were unable to determine your location at this time. Please '
          + 'try again later, or enter your location manually.'
        );
    } else {
        $('.location-status').html(
            'An error occured while determining your location.'
        );
        jQuery.post(base+'ajax/update_location/', {
            method: 'error',
        });
    }
}

function getGearsPositionInterface(name) {
    if (positionGeo == null)
        positionGeo = google.gears.factory.create('beta.geolocation');
    geo = positionGeo;
    
    function wrapWithPermission(fname) {
        return function(successCallback, errorCallback, options) {
            if (geo.getPermission(name)) {
                if (fname == 'gcp')
                    return geo.getCurrentPosition(successCallback, errorCallback, options);
                else
                    return geo.watchPosition(successCallback, errorCallback, options);
            } else
                errorCallback({
                    PERMISSION_DENIED: geo.PositionEror.PERMISSION_DENIED,
                    code: geo.PositionError.PERMISSION_DENIED,
                });
        };
    }
    
    return {
        getCurrentPosition: wrapWithPermission('getCurrentPosition'),
        watchPosition: wrapWithPermission('watchPosition'),
        clearWatch: function(id) {
            geo.clearWatch(id);
        },
    }
}

function positionWatcher(position) {
    positionRequestCount += 1;
    if (positionRequestCount > 10 || position.coords.accuracy <= 150 || position.coords.accuracy == 18000) {
        positionInterface.clearWatch(positionWatchId);
        positionWatchId = null;
    }
    
    sendPosition(position, positionWatchId != null);
}

function requestPosition() {
    if (positionWatchId != null)
        return; 
        
    location_options = {
            enableHighAccuracy: true,
            maximumAge: 30000,
    }
    if (window.google && google.gears) {
        positionInterface = getGearsPositionInterface('Oxford Mobile Portal');
        positionMethod = 'gears';
    } else if (window.navigator && navigator.geolocation) {
        positionInterface = navigator.geolocation;
        positionMethod = 'html5';
    }
    
        $('.update-location').slideUp();
    if (positionInterface) {
        $('.location-container').html('Please wait while we attempt to determine your location...');
        positionWatchId = positionInterface.watchPosition(positionWatcher, sendPositionError, location_options);
    } else
        $('.location-container').html('We have no means of determining your location automatically.');
}

function positionMethodAvailable() {
    return ((window.navigator && navigator.geolocation) || (window.google && google.gears))
}

function toggleUpdateLocation() {
    $('.update-location').slideToggle();
}

if (require_location)
    jQuery(document).ready(requestPosition);


$(document).ready(function() {
    $('.update-location').css('display', 'none');
    $('.location-container').append(
        ' <a href="#" onclick="javascript:toggleUpdateLocation(); return false;">Update</a>');
        
    if (positionMethodAvailable()) {
        $('#geolocate-js').html(
            '<a href="#" onclick="javascript:requestPosition(); return false;">Determine location automaticaly</a>');
    }
});