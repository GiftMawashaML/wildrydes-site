var WildRydes = window.WildRydes || {};

(function scopeWrapper($) {
    var signinUrl = '/signin.html';

    var poolData = {
        UserPoolId: _config.cognito.userPoolId,
        ClientId: _config.cognito.userPoolClientId
    };

    var userPool;

    if (!(_config.cognito.userPoolId &&
          _config.cognito.userPoolClientId &&
          _config.cognito.region)) {
        $('#noCognitoMessage').show();
        return;
    }

    userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    if (typeof AWSCognito !== 'undefined') {
        AWSCognito.config.region = _config.cognito.region;
    }

    WildRydes.signOut = function signOut() {
        var cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
            cognitoUser.signOut();
        }
    };

    WildRydes.authToken = new Promise(function fetchCurrentAuthToken(resolve, reject) {
        var cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
            cognitoUser.getSession(function sessionCallback(err, session) {
                if (err) {
                    reject(err);
                } else if (!session.isValid()) {
                    resolve(null);
                } else {
                    resolve(session.getIdToken().getJwtToken());
                }
            });
        } else {
            resolve(null);
        }
    });

    // Register new user
    function register(email, password, onSuccess, onFailure) {
        var dataEmail = {
            Name: 'email',
            Value: email
        };
        var attributeEmail = new AmazonCognitoIdentity.CognitoUserAttribute(dataEmail);
        var secretHash = getSecretHash(email); // Calculate secret hash

        userPool.signUp(email, password, [attributeEmail], null, function signUpCallback(err, result) {
            if (!err) {
                onSuccess(result);
            } else {
                onFailure(err);
            }
        }, secretHash); // Pass secret hash here
    }

    // Sign in existing user
    function signin(email, password, onSuccess, onFailure) {
        var secretHash = getSecretHash(email); // Calculate secret hash

        var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: email, // Use email as username
            Password: password,
            SecretHash: secretHash // Include secret hash for authentication
        });

        var cognitoUser = createCognitoUser(email);
        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: onSuccess,
            onFailure: onFailure
        });
    }

    // Verify user after registration
    function verify(email, code, onSuccess, onFailure) {
        createCognitoUser(email).confirmRegistration(code, true, function confirmCallback(err, result) {
            if (!err) {
                onSuccess(result);
            } else {
                onFailure(err);
            }
        });
    }

    // Create CognitoUser for authentication
    function createCognitoUser(email) {
        return new AmazonCognitoIdentity.CognitoUser({
            Username: email, // Use email directly
            Pool: userPool
        });
    }

    // Get Secret Hash for Cognito authentication
    function getSecretHash(username) {
        var clientId = _config.cognito.userPoolClientId;
        var clientSecret = _config.cognito.clientSecret;
        if (clientSecret) {
            var message = username + clientId;
            var hash = CryptoJS.HmacSHA256(message, clientSecret);
            return hash.toString(CryptoJS.enc.Base64);
        }
        return null; // No secret hash if no client secret is used
    }

    // When the document is ready, attach event listeners
    $(function onDocReady() {
        $('#signinForm').submit(handleSignin);
        $('#registrationForm').submit(handleRegister);
        $('#verifyForm').submit(handleVerify);
    });

    // Handle Sign In form submission
    function handleSignin(event) {
        var email = $('#emailInputSignin').val();
        var password = $('#passwordInputSignin').val();
        event.preventDefault();
        signin(email, password,
            function signinSuccess() {
                console.log('Successfully Logged In');
                window.location.href = 'ride.html';
            },
            function signinError(err) {
                alert(err);
            }
        );
    }

    // Handle Register form submission
    function handleRegister(event) {
        var email = $('#emailInputRegister').val();
        var password = $('#passwordInputRegister').val();
        var password2 = $('#password2InputRegister').val();

        var onSuccess = function registerSuccess(result) {
            var cognitoUser = result.user;
            console.log('user name is ' + cognitoUser.getUsername());
            alert('Registration successful. Please check your email inbox or spam folder for your verification code.');
            window.location.href = 'verify.html';
        };

        var onFailure = function registerFailure(err) {
            alert('Error: ' + err.message);
        };

        event.preventDefault();

        if (password === password2) {
            register(email, password, onSuccess, onFailure);
        } else {
            alert('Passwords do not match');
        }
    }

    // Handle Verify form submission
    function handleVerify(event) {
        var email = $('#emailInputVerify').val();
        var code = $('#codeInputVerify').val();
        event.preventDefault();
        verify(email, code,
            function verifySuccess(result) {
                console.log('call result: ' + result);
                alert('Verification successful. You will now be redirected to the login page.');
                window.location.href = signinUrl;
            },
            function verifyError(err) {
                alert('Error: ' + err.message);
            }
        );
    }
}(jQuery));
