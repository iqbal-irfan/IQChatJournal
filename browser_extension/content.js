// IQChatJournal Browser Capture
// Step 8: receive conversation data

console.log("IQChatJournal content script loaded.");

let latestConversation = null;

let capturedPages = {};

let saveTimerStarted = false;

let lastAutoSavedText = null;

// Prevent duplicate Gemini conversation notifications
// when the DOM changes but the actual conversation
// content has not changed.
let lastGeminiCapturedText = null;

// Tracks which "before" cursors we've already REQUESTED a
// previous page for, per conversation. Prevents firing a
// duplicate REQUEST_PREVIOUS_PAGE when the SAME page arrives
// twice - e.g. once via our own pagination chain and again
// because ChatGPT's own UI independently fetched (and thus
// we independently intercepted) the same page while scrolling.
let requestedCursors = {};

// --------------------------------------------------
// CHECKPOINT / RESUME STATE
// --------------------------------------------------

// Per-conversation checkpoint loaded from chrome.storage.local:
// { earliest_cursor, messages: [...] }
// Loaded lazily the first time we see a given conversationId
// in this page session.
let checkpoints = {};
let checkpointLoadPromises = {};

const NUM_TURNS_PER_PAGE = 50;

function checkpointStorageKey(conversationId) {
    return "iqcj_checkpoint_" + conversationId;
}

function loadCheckpoint(conversationId) {

    if (checkpointLoadPromises[conversationId]) {
        return checkpointLoadPromises[conversationId];
    }

    checkpointLoadPromises[conversationId] =
        new Promise((resolve) => {

            try {

                chrome.storage.local.get(
                    [checkpointStorageKey(conversationId)],
                    (result) => {

                        if (chrome.runtime.lastError) {

                            console.log(
                                "IQChatJournal: checkpoint load error:",
                                chrome.runtime.lastError.message
                            );

                            checkpoints[conversationId] = null;
                            resolve(null);
                            return;
                        }

                        const stored =
                            result[
                                checkpointStorageKey(conversationId)
                            ] || null;

                        checkpoints[conversationId] = stored;

                        if (stored) {

                            console.log(
                                "IQChatJournal: RESUMING from checkpoint:",
                                conversationId,
                                "|",
                                (stored.messages || []).length,
                                "previously saved messages"
                            );

                        }

                        resolve(stored);

                    }
                );

            } catch (error) {

                console.log(
                    "IQChatJournal: checkpoint load exception:",
                    error
                );

                checkpoints[conversationId] = null;
                resolve(null);

            }

        });

    return checkpointLoadPromises[conversationId];
}

function saveCheckpoint(conversationId, earliestCursor, messages) {

    try {

        chrome.storage.local.set(
            {
                [checkpointStorageKey(conversationId)]: {
                    earliest_cursor: earliestCursor,
                    messages: messages,
                    updated_at: new Date().toISOString()
                }
            },
            () => {

                if (chrome.runtime.lastError) {

                    console.log(
                        "IQChatJournal: checkpoint save error:",
                        chrome.runtime.lastError.message
                    );

                    return;
                }

                console.log(
                    "IQChatJournal: checkpoint saved:",
                    conversationId,
                    "|",
                    messages.length,
                    "messages"
                );

            }
        );

    } catch (error) {

        console.log(
            "IQChatJournal: checkpoint save exception:",
            error
        );

    }
}

function messageId(msg) {
    return (
        (msg && msg.id) ||
        (msg && msg.uuid) ||
        (msg && msg.message && msg.message.id) ||
        JSON.stringify(msg).slice(0, 80)
    );
}

function getMessageArray(data) {
    if (!data) {
        return [];
    }
    if (Array.isArray(data.messages)) {
        return data.messages;
    }
    if (Array.isArray(data.chat_messages)) {
        return data.chat_messages;
    }
    return [];
}

// -----------------------------
// AUTO SAVE
// -----------------------------

function startAutoSave() {

    if (saveTimerStarted) {
        return;
    }

    saveTimerStarted = true;

    setInterval(() => {

        if (!latestConversation) {
            return;
        }

        if (
            latestConversation.text ===
            lastAutoSavedText
        ) {

            console.log(
                "IQChatJournal:",
                "AUTO-SAVE skipped - no changes."
            );

            return;
        }

        console.log(
            "IQChatJournal:",
            "REQUESTING AUTO-SAVE:",
            latestConversation.text.length,
            "bytes"
        );

        try {

            chrome.runtime.sendMessage(
                {
                    type: "SAVE_CONVERSATION",
                    payload: latestConversation
                },
                (response) => {

                    if (chrome.runtime.lastError) {

                        console.warn(
                            "IQChatJournal: AUTO-SAVE skipped:",
                            chrome.runtime.lastError.message
                        );

                        return;
                    }

                    if (
                        response &&
                        response.ok &&
                        response.saved
                    ) {

                        lastAutoSavedText =
                            latestConversation.text;
                    }

                    console.log(
                        "IQChatJournal:",
                        "AUTO-SAVE COMPLETE:",
                        response
                    );
                }
            );

        } catch (error) {

            console.warn(
                "IQChatJournal: Extension context invalidated."
            );

        }

    }, 60 * 1000);
}


// -----------------------------
// TEST BACKGROUND CONNECTION
// -----------------------------

chrome.runtime.sendMessage(
    {
        type: "PING"
    },
    (response) => {

        if (chrome.runtime.lastError) {

            console.log(
                "IQChatJournal:",
                chrome.runtime.lastError.message
            );

            return;
        }

        console.log(
            "IQChatJournal:",
            response
        );
    }
);


// -----------------------------
// PREVIOUS PAGE FETCH GAVE UP
// (rate limited past max retries, or hard failure)
// -----------------------------

window.addEventListener("message", (event) => {

    if (event.source !== window) {
        return;
    }

    if (!event.data) {
        return;
    }

    if (event.data.source !== "IQChatJournal") {
        return;
    }

    if (event.data.type === "PREVIOUS_PAGE_FAILED") {

        console.log(
            "IQChatJournal:",
            "Previous page fetch gave up:",
            event.data.reason,
            "- saving what we have so far."
        );

        // Force a save attempt with whatever we've captured,
        // rather than waiting on a page that will never arrive.
        if (latestConversation) {

            try {

                chrome.runtime.sendMessage(
                    {
                        type: "SAVE_CONVERSATION",
                        payload: latestConversation
                    },
                    (response) => {

                        if (chrome.runtime.lastError) {
                            return;
                        }

                        console.log(
                            "IQChatJournal:",
                            "PARTIAL SAVE (after giving up):",
                            response
                        );

                    }
                );

            } catch (error) {

                console.warn(
                    "IQChatJournal: Extension context invalidated."
                );

            }

        }

    }

});


// -----------------------------
// RECEIVE PAGE-HOOK MESSAGES
// -----------------------------

window.addEventListener("message", (event) => {

    if (event.source !== window) {
        return;
    }

    if (!event.data) {
        return;
    }

    if (event.data.source !== "IQChatJournal") {
        return;
    }


    // -------------------------
    // Hook ready
    // -------------------------

    if (event.data.type === "HOOK_READY") {

        console.log(
            "IQChatJournal PAGE:",
            "HOOK_READY"
        );

        return;
    }


    // -------------------------
    // Conversation response
    // -------------------------

    if (event.data.type === "CONVERSATION_RESPONSE") {

        const platform =
            event.data.platform ||
            "chatgpt";

        const url =
            event.data.url;

        const text =
            event.data.text;

        if (
            !text ||
            typeof text !== "string"
        ) {
            return;
        }

        console.log(
            "IQChatJournal:",
            "Conversation response:",
            text.length,
            "bytes"
        );

        console.log(
            "IQChatJournal:",
            "Conversation URL:",
            url
        );


        // --------------------------------
        // GEMINI DOM CAPTURE
        // --------------------------------

        if (platform === "gemini") {

            try {

                const geminiData =
                    JSON.parse(text);

                    
                if (
                    !geminiData.messages ||
                    !Array.isArray(
                        geminiData.messages
                    )
                ) {

                    console.log(
                        "IQChatJournal:",
                        "Invalid Gemini conversation data."
                    );

                    return;

                }


                // --------------------------------
                // GEMINI DUPLICATE CHECK
                // --------------------------------

                if (
                    text ===
                    lastGeminiCapturedText
                ) {

                    console.log(
                        "IQChatJournal:",
                        "Gemini capture skipped - no changes."
                    );

                    return;

                }


                // --------------------------------
                // GEMINI CONVERSATION ID
                // --------------------------------

                const geminiConversationId =
                    geminiData.conversation_id ||
                    (
                        String(url || "").match(
                            /\/app\/([a-zA-Z0-9_-]+)/
                        ) || []
                    )[1] ||
                    null;


                latestConversation = {

                    platform:
                        "gemini",

                    url:
                        url,

                    text:
                        text,

                    conversation_id:
                        geminiConversationId,

                    captured_at:
                        new Date().toISOString()

                };


                lastGeminiCapturedText =
                    text;

                console.log(
                    "IQChatJournal:",
                    "Gemini conversation captured:",
                    geminiData.messages.length,
                    "messages"
                );


                // --------------------------------
                // START AUTO SAVE
                // --------------------------------

                startAutoSave();


                // --------------------------------
                // NOTIFY BACKGROUND
                // --------------------------------

                chrome.runtime.sendMessage(
                    {
                        type:
                            "CONVERSATION_CAPTURED",

                        payload:
                            latestConversation
                    },

                    (response) => {

                        if (
                            chrome.runtime.lastError
                        ) {

                            console.log(
                                "IQChatJournal:",
                                chrome.runtime.lastError.message
                            );

                            return;

                        }


                        console.log(
                            "IQChatJournal:",
                            "Background received:",
                            response
                        );

                    }
                );


            } catch (error) {

                console.log(
                    "IQChatJournal:",
                    "Gemini capture error:",
                    error
                );

            }


            return;

        }


        // --------------------------------
        // KIMI DOM CAPTURE
        // --------------------------------

        if (platform === "kimi") {

            try {

                const kimiData =
                    JSON.parse(text);


                if (
                    !kimiData.messages ||
                    !Array.isArray(
                        kimiData.messages
                    )
                ) {

                    console.log(
                        "IQChatJournal:",
                        "Invalid Kimi conversation data."
                    );

                    return;

                }


                // --------------------------------
                // KIMI CONVERSATION ID
                // --------------------------------

                const kimiConversationId =
                    kimiData.conversation_id ||
                    (
                        String(url || "").match(
                            /\/chat\/([a-zA-Z0-9-]+)/
                        ) || []
                    )[1] ||
                    null;


                latestConversation = {

                    platform:
                        "kimi",

                    url:
                        url,

                    text:
                        text,

                    conversation_id:
                        kimiConversationId,

                    captured_at:
                        new Date().toISOString()

                };


                console.log(
                    "IQChatJournal:",
                    "Kimi conversation captured:",
                    kimiData.messages.length,
                    "messages"
                );


                // --------------------------------
                // START AUTO SAVE
                // --------------------------------

                startAutoSave();


                // --------------------------------
                // NOTIFY BACKGROUND
                // --------------------------------

                chrome.runtime.sendMessage(
                    {
                        type:
                            "CONVERSATION_CAPTURED",

                        payload:
                            latestConversation
                    },

                    (response) => {

                        if (
                            chrome.runtime.lastError
                        ) {

                            console.log(
                                "IQChatJournal:",
                                chrome.runtime.lastError.message
                            );

                            return;

                        }


                        console.log(
                            "IQChatJournal:",
                            "Background received:",
                            response
                        );

                    }
                );


            } catch (error) {

                console.log(
                    "IQChatJournal:",
                    "Kimi capture error:",
                    error
                );

            }


            return;

        }


        // --------------------------------
        // QWEN DOM CAPTURE
        // --------------------------------

        if (platform === "qwen") {

            try {

                const qwenData =
                    JSON.parse(text);


                if (
                    !qwenData.messages ||
                    !Array.isArray(
                        qwenData.messages
                    )
                ) {

                    console.log(
                        "IQChatJournal:",
                        "Invalid Qwen conversation data."
                    );

                    return;

                }


                // --------------------------------
                // QWEN CONVERSATION ID
                // --------------------------------

                const qwenConversationId =
                    qwenData.conversation_id ||
                    (
                        String(url || "").match(
                            /\/(?:c|chat)\/([a-zA-Z0-9_-]+)/
                        ) || []
                    )[1] ||
                    null;


                latestConversation = {

                    platform:
                        "qwen",

                    url:
                        url,

                    text:
                        text,

                    conversation_id:
                        qwenConversationId,

                    captured_at:
                        new Date().toISOString()

                };


                console.log(
                    "IQChatJournal:",
                    "Qwen conversation captured:",
                    qwenData.messages.length,
                    "messages"
                );


                // --------------------------------
                // START AUTO SAVE
                // --------------------------------

                startAutoSave();


                // --------------------------------
                // NOTIFY BACKGROUND
                // --------------------------------

                chrome.runtime.sendMessage(
                    {
                        type:
                            "CONVERSATION_CAPTURED",

                        payload:
                            latestConversation
                    },

                    (response) => {

                        if (
                            chrome.runtime.lastError
                        ) {

                            console.log(
                                "IQChatJournal:",
                                chrome.runtime.lastError.message
                            );

                            return;

                        }


                        console.log(
                            "IQChatJournal:",
                            "Background received:",
                            response
                        );

                    }
                );


            } catch (error) {

                console.log(
                    "IQChatJournal:",
                    "Qwen capture error:",
                    error
                );

            }


            return;

        }


        // --------------------------------
        // DEEPSEEK DOM CAPTURE
        // --------------------------------

        if (platform === "deepseek") {

            try {

                const deepSeekData =
                    JSON.parse(text);

                if (
                    !deepSeekData.messages ||
                    !Array.isArray(
                        deepSeekData.messages
                    )
                ) {

                    console.log(
                        "IQChatJournal:",
                        "Invalid DeepSeek conversation data."
                    );

                    return;
                }


                // --------------------------------
                // DEEPSEEK CONVERSATION ID
                // --------------------------------

                const deepSeekConversationId =
                    deepSeekData.conversation_id ||
                    (
                        String(url || "").match(
                            /\/a\/chat\/s\/([a-zA-Z0-9-]+)/
                        ) || []
                    )[1] ||
                    null;


                latestConversation = {

                    platform:
                        "deepseek",

                    url:
                        url,

                    text:
                        text,

                    conversation_id:
                        deepSeekConversationId,

                    captured_at:
                        new Date().toISOString()

                };


                console.log(
                    "IQChatJournal:",
                    "DeepSeek conversation captured:",
                    deepSeekData.messages.length,
                    "messages"
                );


                // --------------------------------
                // START AUTO SAVE
                // --------------------------------

                startAutoSave();


                // --------------------------------
                // NOTIFY BACKGROUND
                // --------------------------------

                chrome.runtime.sendMessage(
                    {
                        type:
                            "CONVERSATION_CAPTURED",

                        payload:
                            latestConversation
                    },

                    (response) => {

                        if (
                            chrome.runtime.lastError
                        ) {

                            console.log(
                                "IQChatJournal:",
                                chrome.runtime.lastError.message
                            );

                            return;
                        }


                        console.log(
                            "IQChatJournal:",
                            "Background received:",
                            response
                        );

                    }
                );


            } catch (error) {

                console.log(
                    "IQChatJournal:",
                    "DeepSeek capture error:",
                    error
                );

            }


            return;

        }


        // --------------------------------
        // STORE ALL CONVERSATION PAGES
        // --------------------------------

        let conversationId = null;

        try {

            const parsedUrl = new URL(
                url,
                window.location.origin
            );

            const conversationMatch =
                parsedUrl.pathname.match(
                    /\/backend-api\/conversations\/([a-f0-9-]+)/i
                ) ||
                parsedUrl.pathname.match(
                    /\/chat_conversations\/([a-f0-9-]+)/i
                );

            if (!conversationMatch) {
                return;
            }

            conversationId =
                conversationMatch[1];

            // --------------------------------
            // RESPONSE ANALYSIS + PAGINATION
            // --------------------------------

            try {

                const conversationData =
                    JSON.parse(text);

                console.log(
                    "IQChatJournal: Direct messages:",
                    getMessageArray(conversationData).length
                );

                console.log(
                    "IQChatJournal: Page info:",
                    conversationData.page_info
                );

                const checkpoint =
                    checkpoints[conversationId];

                // Build (once per checkpoint) a lookup of every
                // message id we've already saved for this
                // conversation, so we can detect overlap with a
                // freshly-fetched page as early as possible -
                // ideally on the very first (newest) page, so a
                // chat we've already fully captured before needs
                // NO backward pagination at all on reopen.
                if (
                    checkpoint &&
                    !checkpoint._knownIds
                ) {

                    checkpoint._knownIds = new Set(
                        (checkpoint.messages || []).map(
                            messageId
                        )
                    );

                }

                const pageMessages =
                    getMessageArray(conversationData);

                const overlapsKnownHistory =
                    !!(
                        checkpoint &&
                        checkpoint._knownIds &&
                        pageMessages.some(
                            (msg) =>
                                checkpoint._knownIds.has(
                                    messageId(msg)
                                )
                        )
                    );

                const reachedCheckpoint =
                    overlapsKnownHistory ||
                    !!(
                        checkpoint &&
                        checkpoint.earliest_cursor &&
                        conversationData.page_info &&
                        conversationData.page_info.start_cursor ===
                            checkpoint.earliest_cursor
                    );

                if (reachedCheckpoint) {

                    console.log(
                        "IQChatJournal: Reached previously-saved messages" +
                            (overlapsKnownHistory
                                ? " (overlap detected)"
                                : " (matched earliest cursor)") +
                            " - stopping pagination here."
                    );

                }

                if (!requestedCursors[conversationId]) {
                    requestedCursors[conversationId] = new Set();
                }

                const startCursor =
                    conversationData.page_info &&
                    conversationData.page_info.start_cursor;

                const alreadyRequestedThisCursor =
                    !!(
                        startCursor &&
                        requestedCursors[conversationId].has(
                            startCursor
                        )
                    );

                if (
                    !reachedCheckpoint &&
                    !alreadyRequestedThisCursor &&
                    conversationData.page_info &&
                    conversationData.page_info.has_previous_page &&
                    startCursor
                ) {

                    requestedCursors[conversationId].add(
                        startCursor
                    );

                    const previousPageUrl =
                        parsedUrl.origin +
                        parsedUrl.pathname +
                        "?before=" +
                        encodeURIComponent(
                            startCursor
                        ) +
                        "&include_has_versions=true" +
                        "&num_turns=" +
                        NUM_TURNS_PER_PAGE;

                    console.log(
                        "IQChatJournal: REQUESTING PREVIOUS PAGE:",
                        previousPageUrl
                    );

                    window.postMessage(
                        {
                            source: "IQChatJournal",
                            type: "REQUEST_PREVIOUS_PAGE",
                            url: previousPageUrl
                        },
                        "*"
                    );

                } else if (alreadyRequestedThisCursor) {

                    console.log(
                        "IQChatJournal: Already requested this cursor - skipping duplicate."
                    );

                }

            } catch (error) {

                console.log(
                    "IQChatJournal: Response analysis error:",
                    error
                );

            }

            if (!capturedPages[conversationId]) {

                capturedPages[conversationId] = [];

            }

            const alreadyCaptured =
                capturedPages[conversationId].some(
                    (page) => page.text === text
                );

            if (!alreadyCaptured) {

                capturedPages[conversationId].push({
                    url: url,
                    text: text,
                    captured_at:
                        new Date().toISOString()
                });

                console.log(
                    "IQChatJournal:",
                    "Captured page:",
                    capturedPages[conversationId].length,
                    "|",
                    text.length,
                    "bytes"
                );

            } else {

                console.log(
                    "IQChatJournal:",
                    "Duplicate page ignored."
                );

            }

        } catch (error) {

            console.log(
                "IQChatJournal:",
                "Page storage error:",
                error
            );

            return;

        }


        // --------------------------------
        // BUILD COMBINED CONVERSATION
        // (merge this-session pages + previous checkpoint messages)
        // --------------------------------

        loadCheckpoint(conversationId).then((checkpoint) => {

            const allPages = capturedPages[conversationId] || [];

            const parsedPages = allPages
                .map((page) => {
                    try {
                        return JSON.parse(page.text);
                    } catch (error) {
                        return null;
                    }
                })
                .filter((page) => page !== null);

            // capturedPages: index 0 = newest (original) page,
            // each later entry goes further back. Reverse so we
            // assemble oldest -> newest for THIS session's pages.
            const orderedPages = [...parsedPages].reverse();

            const seenIds = new Set();
            const mergedMessages = [];

            // Seed with previously checkpointed messages first
            // (oldest known history), then layer this session's
            // pages on top, deduping by id throughout.
            const previouslySaved =
                (checkpoint && checkpoint.messages) || [];

            previouslySaved.forEach((msg) => {
                const id = messageId(msg);
                if (seenIds.has(id)) {
                    return;
                }
                seenIds.add(id);
                mergedMessages.push(msg);
            });

            orderedPages.forEach((page) => {
                const messages =
                    getMessageArray(page);
                messages.forEach((msg) => {
                    const id = messageId(msg);
                    if (seenIds.has(id)) {
                        return;
                    }
                    seenIds.add(id);
                    mergedMessages.push(msg);
                });
            });

            const basePage =
                parsedPages.length > 0
                    ? parsedPages[0]
                    : {};

            // Write the merged messages back under whichever field
            // name this platform actually uses, so the saved JSON
            // keeps the shape each platform's parser expects
            // (ChatGPT: "messages", Claude: "chat_messages").
            const messagesFieldName =
                Array.isArray(basePage.chat_messages)
                    ? "chat_messages"
                    : "messages";

            const combinedData = {
                ...basePage,
                [messagesFieldName]: mergedMessages
            };

            // Guard against a leftover unmerged copy under the
            // OTHER field name if basePage happened to have both.
            if (messagesFieldName === "chat_messages") {
                delete combinedData.messages;
            } else {
                delete combinedData.chat_messages;
            }

            const combinedText =
                mergedMessages.length > 0
                    ? JSON.stringify(combinedData)
                    : "";

            if (!combinedText) {
                return;
            }

            latestConversation = {
                platform: platform,
                url: url,
                text: combinedText,
                conversation_id: conversationId,
                captured_at:
                    new Date().toISOString()
            };

            console.log(
                "IQChatJournal:",
                "Combined pages:",
                allPages.length,
                "|",
                "merged messages:",
                mergedMessages.length,
                "|",
                combinedText.length,
                "bytes"
            );

            // Figure out the new earliest cursor reached so far,
            // so the checkpoint can be updated. Prefer the oldest
            // page's start_cursor from this session; fall back to
            // the existing checkpoint's if we haven't paginated
            // further back than before.
            const oldestPageThisSession =
                orderedPages.length > 0
                    ? orderedPages[0]
                    : null;

            const newEarliestCursor =
                (oldestPageThisSession &&
                    oldestPageThisSession.page_info &&
                    oldestPageThisSession.page_info.start_cursor) ||
                (checkpoint && checkpoint.earliest_cursor) ||
                null;

            if (newEarliestCursor) {

                saveCheckpoint(
                    conversationId,
                    newEarliestCursor,
                    mergedMessages
                );

            }

            checkpoints[conversationId] = {
                earliest_cursor: newEarliestCursor,
                messages: mergedMessages
            };


            // --------------------------------
            // START AUTO SAVE
            // --------------------------------

            startAutoSave();


            // --------------------------------
            // NOTIFY BACKGROUND
            // --------------------------------

            chrome.runtime.sendMessage(
                {
                    type: "CONVERSATION_CAPTURED",
                    payload: latestConversation
                },
                (response) => {

                    if (chrome.runtime.lastError) {

                        console.log(
                            "IQChatJournal:",
                            chrome.runtime.lastError.message
                        );

                        return;
                    }

                    console.log(
                        "IQChatJournal:",
                        "Background received:",
                        response
                    );
                }
            );

        });

    }

});


// -----------------------------
// MANUAL SAVE
// -----------------------------

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (
            !message ||
            message.type !== "MANUAL_SAVE"
        ) {
            return;
        }


        if (!latestConversation) {

            console.log(
                "IQChatJournal:",
                "No conversation available for manual save."
            );

            sendResponse({
                ok: false,
                message:
                    "No conversation captured yet."
            });

            return true;
        }


        console.log(
            "================================"
        );

        console.log(
            "IQChatJournal:",
            "MANUAL SAVE START:",
            latestConversation.text.length,
            "bytes"
        );


        try {

            chrome.runtime.sendMessage(
                {
                    type: "SAVE_CONVERSATION",
                    payload: latestConversation
                },
                (response) => {

                    if (chrome.runtime.lastError) {

                        console.log(
                            "IQChatJournal MANUAL SAVE ERROR:",
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
                        "MANUAL SAVE COMPLETE:",
                        response
                    );


                    sendResponse({
                        ok: true,
                        response: response
                    });

                }
            );

        } catch (error) {

            console.warn(
                "IQChatJournal: Extension context invalidated."
            );

            sendResponse({
                ok: false,
                message:
                    "Extension was reloaded. Refresh this page."
            });

        }


        return true;
    }
);