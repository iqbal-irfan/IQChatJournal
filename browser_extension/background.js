// IQChatJournal Browser Capture
// Background service worker

console.log("IQChatJournal background started.");


// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function getConversationId(url) {

    if (!url) {
        return null;
    }

    const match =
        String(url).match(
            /\/conversations?\/([a-f0-9-]+)/i
        );

    if (!match) {
        return null;
    }

    return match[1];
}


// --------------------------------------------------
// SAVE CONVERSATION TO DOWNLOADS
// --------------------------------------------------

function downloadConversation(
    payload,
    sendResponse
) {

    if (
        !payload ||
        !payload.text
    ) {

        console.log(
            "IQChatJournal:",
            "Nothing to save."
        );

        sendResponse({
            ok: false
        });

        return;
    }


    // Prefer the conversation_id already computed in content.js
    // (from the ORIGINAL, non-paginated request path) over
    // re-deriving it from payload.url, since latestConversation.url
    // may end up being a paginated "/messages?before=..." URL once
    // multi-page capture is in play.
    const conversationId =
        payload.conversation_id ||
        getConversationId(
            payload.url
        );


    if (!conversationId) {

        console.log(
            "IQChatJournal:",
            "Conversation ID not found."
        );

        sendResponse({
            ok: false
        });

        return;
    }


    const filename =
        conversationId + ".json";


    const dataUrl =
        "data:application/json;charset=utf-8," +
        encodeURIComponent(
            payload.text
        );


    console.log(
        "IQChatJournal:",
        "SAVE START:",
        conversationId
    );


    console.log(
        "IQChatJournal:",
        "SAVE SIZE:",
        payload.text.length,
        "bytes"
    );


    chrome.downloads.download(
        {
            url: dataUrl,

            filename: filename,

            conflictAction:
                "overwrite",

            saveAs: false
        },

        (downloadId) => {

            if (
                chrome.runtime.lastError
            ) {

                console.log(
                    "IQChatJournal SAVE ERROR:",
                    chrome.runtime.lastError.message
                );

                sendResponse({
                    ok: false,
                    message:
                        chrome.runtime.lastError.message
                });

                return;
            }


            console.log(
                "IQChatJournal:",
                "SAVED:",
                conversationId,
                "download:",
                downloadId
            );


            sendResponse({
                ok: true,

                conversation_id:
                    conversationId,

                saved: true,

                download_id:
                    downloadId
            });

        }
    );
}


// --------------------------------------------------
// RECEIVE MESSAGES
// --------------------------------------------------

chrome.runtime.onMessage.addListener(

    (
        message,
        sender,
        sendResponse
    ) => {

        if (
            !message ||
            !message.type
        ) {

            return;
        }


        // ----------------------------------------------
        // PING
        // ----------------------------------------------

        if (
            message.type ===
            "PING"
        ) {

            console.log(
                "IQChatJournal:",
                "PING received"
            );


            sendResponse({
                ok: true,

                message:
                    "IQChatJournal extension is running."
            });


            return true;
        }


        // ----------------------------------------------
        // CONVERSATION CAPTURED
        // ----------------------------------------------

        if (
            message.type ===
            "CONVERSATION_CAPTURED"
        ) {

            const payload =
                message.payload;


            if (
                !payload ||
                !payload.text
            ) {

                console.log(
                    "IQChatJournal:",
                    "Empty conversation received."
                );


                sendResponse({
                    ok: false
                });


                return true;
            }


            console.log(
                "================================"
            );

            console.log(
                "IQChatJournal:",
                "CONVERSATION RECEIVED"
            );

            console.log(
                "URL:",
                payload.url
            );

            console.log(
                "SIZE:",
                payload.text.length,
                "bytes"
            );


            // Prefer the conversation_id already computed in
            // content.js over re-deriving it from payload.url.
            const conversationId =
                payload.conversation_id ||
                getConversationId(
                    payload.url
                );


            if (!conversationId) {

                console.log(
                    "IQChatJournal:",
                    "Conversation ID not found."
                );


                sendResponse({
                    ok: false
                });


                return true;
            }


            // ------------------------------------------
            // NO LARGE SAFE COPY IN chrome.storage.local
            // ------------------------------------------
            //
            // The complete conversation is already maintained
            // by content.js as the checkpoint and is sent to the
            // Python application through the normal download path.
            //
            // Keeping another complete copy here can exceed the
            // Chrome extension storage quota for large chats.
            //


            sendResponse({
                ok: true,

                conversation_id:
                    conversationId,

                saved: false,

                stored: false
            });


            return true;
        }


        // ----------------------------------------------
        // SAVE CONVERSATION
        // ----------------------------------------------

        if (
            message.type ===
            "SAVE_CONVERSATION"
        ) {

            downloadConversation(
                message.payload,
                sendResponse
            );


            return true;
        }

    }
);


// --------------------------------------------------
// MANUAL SAVE FROM EXTENSION ICON
// --------------------------------------------------

chrome.action.onClicked.addListener(

    (tab) => {

        console.log(
            "================================"
        );

        console.log(
            "IQChatJournal:",
            "MANUAL SAVE REQUEST"
        );


        if (
            !tab ||
            !tab.id
        ) {

            console.log(
                "IQChatJournal:",
                "NO TAB ID"
            );

            return;
        }


        console.log(
            "IQChatJournal:",
            "TAB ID:",
            tab.id
        );


        console.log(
            "IQChatJournal:",
            "TAB URL:",
            tab.url
        );


        // ----------------------------------------------
        // FIRST TRY CONTENT SCRIPT
        // ----------------------------------------------

        chrome.tabs.sendMessage(

            tab.id,

            {
                type:
                    "MANUAL_SAVE"
            },

            (response) => {

                if (
                    chrome.runtime.lastError
                ) {

                    console.log(
                        "IQChatJournal:",
                        "CONTENT SCRIPT UNAVAILABLE:",
                        chrome.runtime.lastError.message
                    );


                    return;
                }


                console.log(
                    "IQChatJournal:",
                    "MANUAL SAVE RESPONSE:",
                    response
                );

            }

        );

    }

);