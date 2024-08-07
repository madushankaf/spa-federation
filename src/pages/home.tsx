/**
 * Copyright (c) 2021, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { BasicUserInfo, Hooks, useAuthContext } from "@asgardeo/auth-react";
import React, { FunctionComponent, ReactElement, useCallback, useEffect, useState } from "react";
import { default as authConfig } from "../config.json";
import REACT_LOGO from "../images/react-logo.png";
import { DefaultLayout } from "../layouts/default";
import { AuthenticationResponse } from "../components";
import { useLocation } from "react-router-dom";
import { LogoutRequestDenied } from "../components/LogoutRequestDenied";
import { USER_DENIED_LOGOUT } from "../constants/errors";

interface DerivedState {
    authenticateResponse: BasicUserInfo,
    idToken: string[],
    decodedIdTokenHeader: string,
    decodedIDTokenPayload: Record<string, string | number | boolean>;
}

interface EchoOutPutChoreo {
    returnedJwt: string;
    status: string;
    errorMessage?: string;

}

interface EchoOutPutDev {
    returnedJwt: string;
    status: string;
    errorMessage?: string;

}

/**
 * Home page for the Sample.
 *
 * @param props - Props injected to the component.
 *
 * @return {React.ReactElement}
 */
export const HomePage: FunctionComponent = (): ReactElement => {

    const {
        state,
        signIn,
        signOut,
        getBasicUserInfo,
        getIDToken,
        getDecodedIDToken,
        on
    } = useAuthContext();

    const [derivedAuthenticationState, setDerivedAuthenticationState] = useState<DerivedState>(null);
    const [hasAuthenticationErrors, setHasAuthenticationErrors] = useState<boolean>(false);
    const [hasLogoutFailureError, setHasLogoutFailureError] = useState<boolean>();

    const search = useLocation().search;
    const stateParam = new URLSearchParams(search).get('state');
    const errorDescParam = new URLSearchParams(search).get('error_description');
    const [echoOutputChoreo, setEchoOutputChoreo] = useState<EchoOutPutChoreo>(null);
    const [echoOutputDev, setEchoOutputDev] = useState<EchoOutPutDev>(null);
    useEffect(() => {

        if (!state?.isAuthenticated) {
            return;
        }

        (async (): Promise<void> => {
            const basicUserInfo = await getBasicUserInfo();
            const idToken = await getIDToken();
            const decodedIDToken = await getDecodedIDToken();

            const derivedState: DerivedState = {
                authenticateResponse: basicUserInfo,
                idToken: idToken.split("."),
                decodedIdTokenHeader: JSON.parse(atob(idToken.split(".")[0])),
                decodedIDTokenPayload: decodedIDToken
            };

            setDerivedAuthenticationState(derivedState);
        })();
    }, [state.isAuthenticated, getBasicUserInfo, getIDToken, getDecodedIDToken]);

    useEffect(() => {
        if (stateParam && errorDescParam) {
            if (errorDescParam === "End User denied the logout request") {
                setHasLogoutFailureError(true);
            }
        }
    }, [stateParam, errorDescParam]);

    const handleLogin = useCallback(() => {
        setHasLogoutFailureError(false);
        signIn()
            .catch(() => setHasAuthenticationErrors(true));
    }, [signIn]);

    /**
      * handles the error occurs when the logout consent page is enabled
      * and the user clicks 'NO' at the logout consent page
      */
    useEffect(() => {
        on(Hooks.SignOut, () => {
            setHasLogoutFailureError(false);
        });

        on(Hooks.SignOutFailed, () => {
            if (!errorDescParam) {
                handleLogin();
            }
        })
    }, [on, handleLogin, errorDescParam]);

    const handleLogout = () => {
        signOut();
    };

    const callEchoAPI = (path: string) => {
        console.log("Calling Echo API");
        console.log(derivedAuthenticationState.idToken[0] + '.' + derivedAuthenticationState.idToken[1] + '.' + derivedAuthenticationState.idToken[2]);

        setEchoOutputChoreo({ ...echoOutputChoreo, status: 'loading', errorMessage: '' });

        fetch("https://c5924961-7abb-43f1-9929-4a0c38f91e2e-nonprod.nonprod.uou.choreoapis.dev/trrm/api_tester/v0/" + path, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "accept": "*/*",
                "Authorization": 'Bearer ' + derivedAuthenticationState.idToken[0] + '.' + derivedAuthenticationState.idToken[1] + '.' + derivedAuthenticationState.idToken[2],
            }
        })
            .then((response) => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        throw new Error(`Error ${errorData.status}: ${errorData.error}`);
                    });
                }
                return response.json();
            })
            .then((data) => {
                const jwt = data.jwt; // assuming the response has a field named 'jwt'
                if (path === "choreo/echo") {
                    setEchoOutputChoreo({ returnedJwt: jwt, status: 'success' });
                }
                else if (path === "dev/echo") {
                    setEchoOutputDev({ returnedJwt: jwt, status: 'success' });
                }
            })
            .catch((error) => {
                console.error('Error fetching the API:', error);
                if (path === "choreo/echo") {
                    setEchoOutputChoreo({ returnedJwt: '', status: 'error', errorMessage: error.message });
                }
                else if (path === "dev/echo") {
                    setEchoOutputDev({ returnedJwt: '', status: 'error', errorMessage: error.message });
                }
            });
    };

    // If `clientID` is not defined in `config.json`, show a UI warning.
    if (!authConfig?.clientID) {

        return (
            <div className="content">
                <h2>You need to update the Client ID to proceed.</h2>
                <p>Please open &quot;src/config.json&quot; file using an editor, and update
                    the <code>clientID</code> value with the registered application&apos;s client ID.</p>
                <p>Visit repo <a
                    href="https://github.com/asgardeo/asgardeo-auth-react-sdk/tree/master/samples/asgardeo-react-app">README</a> for
                    more details.</p>
            </div>
        );
    }

    if (hasLogoutFailureError) {
        return (
            <LogoutRequestDenied
                errorMessage={USER_DENIED_LOGOUT}
                handleLogin={handleLogin}
                handleLogout={handleLogout}
            />
        );
    }

    return (
        <DefaultLayout
            isLoading={state.isLoading}
            hasErrors={hasAuthenticationErrors}
        >
            {
                state.isAuthenticated
                    ? (
                        <div>
                            <div
                                className="content"
                                style={{
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    backgroundColor: '#f0f0f0',
                                    padding: '20px',
                                    border: '1px solid #ccc',
                                    borderRadius: '5px',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <button
                                    className="btn primary mt-4"
                                    style={{
                                        backgroundColor: '#007bff',
                                        color: 'white',
                                        padding: '10px 20px',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        marginTop: '10px'
                                    }}
                                    onClick={() => { callEchoAPI("choreo/echo"); }}
                                >
                                    Call choreo/echo
                                </button>
                                {echoOutputChoreo && echoOutputChoreo.returnedJwt && (
                                    <p style={{ color: '#333' }}>
                                        Returned JWT: {echoOutputChoreo.returnedJwt}
                                    </p>
                                )}
                                {echoOutputChoreo && echoOutputChoreo.errorMessage && (
                                    <p style={{ color: '#333' }}>
                                        {echoOutputChoreo.errorMessage}
                                    </p>
                                )}
                                <button
                                    className="btn primary mt-4"
                                    style={{
                                        backgroundColor: '#007bff',
                                        color: 'white',
                                        padding: '10px 20px',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        marginTop: '10px'
                                    }}
                                    onClick={() => { callEchoAPI("dev/echo"); }}
                                >
                                    Call dev/echo
                                </button>
                                {echoOutputDev && echoOutputDev.returnedJwt && (
                                    <p style={{ color: '#333' }}>
                                        Returned JWT: {echoOutputDev.returnedJwt}
                                    </p>
                                )}
                                {echoOutputDev && echoOutputDev.errorMessage && (
                                    <p style={{ color: '#333' }}>
                                        {echoOutputDev.errorMessage}
                                    </p>
                                )}
                            </div>

                            <div className="content">
                                {/* <AuthenticationResponse
        derivedResponse={derivedAuthenticationState}
    /> */}
                                <button
                                    className="btn primary mt-4"
                                    style={{
                                        backgroundColor: '#007bff',
                                        color: 'white',
                                        padding: '10px 20px',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        marginTop: '10px'
                                    }}
                                    onClick={() => {
                                        handleLogout();
                                    }}
                                >
                                    Logout
                                </button>
                            </div>

                        </div>
                    )
                    : (
                        <div className="content">
                            <div className="home-image">
                                <img alt="react-logo" src={REACT_LOGO} className="react-logo-image logo" />
                            </div>
                            <h4 className={"spa-app-description"}>
                                This is a sample React SPA that demonstrates CAS Authentication via Federation through Choreo's Key Manager.
                                Onboard a user to the Application and test it. Once logged in, the decoded ID Token will be displayed.
                            </h4>
                            <button
                                className="btn primary"
                                onClick={() => {
                                    handleLogin();
                                }}
                            >
                                Login
                            </button>
                        </div>
                    )
            }
        </DefaultLayout>
    );
};
