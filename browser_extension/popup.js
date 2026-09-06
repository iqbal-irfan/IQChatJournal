const saveButton =
    document.getElementById(
        "saveButton"
    );

const status =
    document.getElementById(
        "status"
    );


saveButton.addEventListener(
    "click",

    () => {

        status.textContent =
            "Sending save request...";


        chrome.tabs.query(
            {
                active: true,
                currentWindow: true
            },

            (tabs) => {

                const tab = tabs[0];


                if (!tab || !tab.id) {

                    status.textContent =
                        "No active tab.";

                    return;
                }


                chrome.tabs.sendMessage(
                    tab.id,

                    {
                        type: "MANUAL_SAVE"
                    },

                    (response) => {

                        if (
                            chrome.runtime.lastError
                        ) {

                            console.log(
                                chrome.runtime.lastError.message
                            );

                            status.textContent =
                                "Error: content script not found.";

                            return;
                        }


                        console.log(
                            "IQChatJournal popup response:",
                            response
                        );


                        if (
                            response &&
                            response.ok
                        ) {

                            status.textContent =
                                "Conversation saved.";

                        } else {

                            status.textContent =
                                "Save failed.";

                        }

                    }
                );

            }
        );

    }
);