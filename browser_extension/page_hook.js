// IQChatJournal Browser Capture

// Capture ChatGPT conversation API responses.
// Do not make additional requests.

(function () {

    console.log("IQChatJournal page hook loaded.");


    // --------------------------------------------------
    // RATE LIMIT / PACING CONFIG
    // --------------------------------------------------

    // Minimum gap before firing ANY previous-page request,
    // even on success, to avoid tripping ChatGPT's rate limit
    // in the first place.
    const MIN_REQUEST_GAP_MS = 2500;

    // Exponential backoff on 429: starts at BASE_BACKOFF_MS,
    // doubles each retry, capped at MAX_BACKOFF_MS, gives up
    // after MAX_RETRIES for a given URL.
    const BASE_BACKOFF_MS = 5000;
    const MAX_BACKOFF_MS = 60000;
    const MAX_RETRIES = 6;

    // Tracks retry counts per URL so backoff resets correctly
    // between different pages.
    const retryCounts = {};
    
    // Claude chat
    function isClaudeConversationRequest(url) {

        if (!url) {
            return false;
        }

        try {

            const parsed = new URL(
                String(url),
                window.location.origin
            );

            const isClaudeHost =
                parsed.hostname.endsWith(
                    "claude.ai"
                );

            const looksLikeConversationPath =
                /\/chat_conversations\/[a-f0-9-]+$/i.test(
                    parsed.pathname
                );

            return (
                isClaudeHost &&
                looksLikeConversationPath
            );

        } catch (error) {

            return false;

        }

    }
    // --------------------------------------------------
    // CHECK CONVERSATION URL
    // --------------------------------------------------

    function isConversationRequest(url) {

        if (!url) {

            return false;

        }

        try {

            const parsed = new URL(

                String(url),

                window.location.origin

            );

            return (

                /^\/backend-api\/conversations\/[a-f0-9-]+(?:\/messages)?$/i.test(

                    parsed.pathname

                )

            );

        } catch (error) {

            return false;

        }

    }


    // --------------------------------------------------
    // SEND CONVERSATION TO CONTENT SCRIPT
    // --------------------------------------------------

    function sendConversation(url, text) {

        if (
            !text ||
            typeof text !== "string"
        ) {
            return;
        }

        const platform =
            String(url).includes(
                "claude.ai"
            )
                ? "claude"
                : String(url).includes(
                    "kimi.com"
                )
                    ? "kimi"
                    : "chatgpt";


        console.log(
            "================================"
        );

        console.log(
            "IQChatJournal: CONVERSATION RESPONSE:",
            text.length,
            "bytes"
        );

        console.log(
            "================================"
        );


        window.postMessage(
            {
                source: "IQChatJournal",
                type: "CONVERSATION_RESPONSE",
                platform: platform,
                url: String(url),
                text: text
            },
            "*"
        );
    }


    // --------------------------------------------------
    // SEND FAILURE TO CONTENT SCRIPT
    // (so it can stop waiting / save what it has)
    // --------------------------------------------------

    function sendPreviousPageFailed(url, reason) {

        console.log(
            "IQChatJournal: PREVIOUS PAGE GIVING UP:",
            url,
            reason
        );

        window.postMessage(
            {
                source: "IQChatJournal",
                type: "PREVIOUS_PAGE_FAILED",
                url: String(url),
                reason: String(reason)
            },
            "*"
        );
    }


    // --------------------------------------------------
    // FETCH
    // --------------------------------------------------

    const originalFetch = window.fetch;


    window.fetch =
        async function (...args) {
            
            try {

                const request =
                    args[0];

                const requestUrl =
                    typeof request === "string"
                        ? request
                        : request && request.url;

                if (
                    requestUrl &&
                    String(requestUrl).includes(
                        "/backend-api/conversations/"
                    )
                ) {

                    if (
                        request instanceof Request
                    ) {

                        window.IQChatJournalConversationHeaders =
                            {};

                        for (
                            const [name, value] of
                            request.headers.entries()
                        ) {

                            window.IQChatJournalConversationHeaders[
                                name
                            ] = value;

                        }

                    }

                }

            } catch (error) {

                console.log(
                    "IQChatJournal: ORIGINAL FETCH DETAIL ERROR:",
                    error
                );

            }

            const response =

                await originalFetch.apply(

                    this,

                    args

                );

            try {

                const request =
                    args[0];


                const url =

                    typeof request === "string"

                        ? request

                        : request && request.url;

                // Gemini batchexecute traffic is intentionally
                // not logged here.
                if (
                    isConversationRequest(url) ||
                    isClaudeConversationRequest(url)
                ) {

                    const clone =
                        response.clone();

                    clone.text()

                        .then((text) => {

                            sendConversation(
                                url,
                                text
                            );

                        })

                        .catch((error) => {

                            console.log(
                                "IQChatJournal fetch read error:",
                                error
                            );

                        });
                }

            } catch (error) {

                console.log(
                    "IQChatJournal fetch hook error:",
                    error
                );

            }


            return response;
        };


    // --------------------------------------------------
    // REQUEST PREVIOUS CONVERSATION PAGE
    // (serialized queue: only ONE fetch in flight at a time,
    // deduped by URL, paced, with capped exponential backoff)
    // --------------------------------------------------

    let lastRequestAt = 0;
    let requestInFlight = false;
    let requestQueue = []; // array of URLs, in FIFO order
    let queuedUrls = new Set(); // for fast "already queued" checks

    function enqueuePreviousPage(previousPageUrl) {

        if (
            requestInFlight &&
            previousPageUrl ===
                currentInFlightUrl
        ) {
            // Already actively being fetched right now.
            return;
        }

        if (queuedUrls.has(previousPageUrl)) {
            // Already waiting in the queue.
            console.log(
                "IQChatJournal: DUPLICATE REQUEST IGNORED (already queued):",
                previousPageUrl
            );
            return;
        }

        queuedUrls.add(previousPageUrl);
        requestQueue.push(previousPageUrl);

        processQueue();
    }

    let currentInFlightUrl = null;

    function processQueue() {

        if (requestInFlight) {
            return;
        }

        if (requestQueue.length === 0) {
            return;
        }

        const url = requestQueue.shift();
        queuedUrls.delete(url);

        requestInFlight = true;
        currentInFlightUrl = url;

        const now = Date.now();
        const elapsed = now - lastRequestAt;
        const wait =
            Math.max(
                0,
                MIN_REQUEST_GAP_MS - elapsed
            );

        setTimeout(
            () => {
                fetchPreviousPage(url);
            },
            wait
        );
    }

    function finishCurrentRequest() {
        requestInFlight = false;
        currentInFlightUrl = null;
        processQueue();
    }

    function fetchPreviousPage(previousPageUrl) {

        lastRequestAt = Date.now();

        const conversationHeaders =
            window.IQChatJournalConversationHeaders;

        originalFetch(

            previousPageUrl,

            {

                credentials: "include",

                headers:
                    conversationHeaders || {}

            }

        )
            .then((response) => {

                console.log(
                    "IQChatJournal: PREVIOUS PAGE STATUS:",
                    response.status
                );

                if (
                    response.status === 429
                ) {

                    const attempt =
                        (retryCounts[previousPageUrl] || 0) + 1;

                    retryCounts[previousPageUrl] =
                        attempt;

                    if (attempt > MAX_RETRIES) {

                        delete retryCounts[previousPageUrl];

                        sendPreviousPageFailed(
                            previousPageUrl,
                            "rate limited after " +
                                MAX_RETRIES +
                                " retries"
                        );

                        finishCurrentRequest();

                        return;
                    }

                    const retryAfterHeader =
                        response.headers &&
                        response.headers.get(
                            "Retry-After"
                        );

                    let backoff;

                    if (
                        retryAfterHeader &&
                        !isNaN(Number(retryAfterHeader))
                    ) {

                        // Server told us exactly how long to
                        // wait (seconds) - trust it over our
                        // own guess.
                        backoff =
                            Math.min(
                                MAX_BACKOFF_MS,
                                Number(retryAfterHeader) * 1000
                            );

                        console.log(
                            "IQChatJournal: Server sent Retry-After:",
                            retryAfterHeader,
                            "s - using that instead of computed backoff."
                        );

                    } else {

                        backoff =
                            Math.min(
                                MAX_BACKOFF_MS,
                                BASE_BACKOFF_MS *
                                    Math.pow(2, attempt - 1)
                            );

                    }

                    console.log(
                        "IQChatJournal: RATE LIMITED. Retry",
                        attempt,
                        "/",
                        MAX_RETRIES,
                        "in",
                        backoff,
                        "ms"
                    );

                    // Retry THIS SAME request directly - stay
                    // "in flight" on this URL, don't release
                    // the queue slot, so nothing else can race
                    // in ahead of the retry.
                    setTimeout(
                        () => {
                            fetchPreviousPage(previousPageUrl);
                        },
                        backoff
                    );

                    return;
                }

                if (
                    !response.ok
                ) {

                    console.log(
                        "IQChatJournal: PREVIOUS PAGE FAILED:",
                        response.status
                    );

                    sendPreviousPageFailed(
                        previousPageUrl,
                        "HTTP " + response.status
                    );

                    finishCurrentRequest();

                    return;
                }

                // Success - reset retry counter for this URL.
                delete retryCounts[previousPageUrl];

                return response.text()

                    .then((text) => {

                        sendConversation(
                            previousPageUrl,
                            text
                        );

                        finishCurrentRequest();

                    });

            })
            .catch((error) => {

                console.log(
                    "IQChatJournal: PREVIOUS PAGE REQUEST ERROR:",
                    error
                );

                sendPreviousPageFailed(
                    previousPageUrl,
                    String(error)
                );

                finishCurrentRequest();

            });
    }


    window.addEventListener(
        "message",
        function (event) {

            if (
                event.source !== window ||
                !event.data ||
                event.data.source !== "IQChatJournal" ||
                event.data.type !== "REQUEST_PREVIOUS_PAGE"
            ) {
                return;
            }

            const previousPageUrl =
                event.data.url;

            if (!previousPageUrl) {
                return;
            }

            console.log(
                "IQChatJournal: PAGE REQUESTING PREVIOUS PAGE:",
                previousPageUrl
            );

            enqueuePreviousPage(previousPageUrl);

        }
    );

    // --------------------------------------------------
    // XHR
    // --------------------------------------------------

    const OriginalXHR =
        window.XMLHttpRequest;


    function WrappedXHR() {

        const xhr =
            new OriginalXHR();


        let requestURL = "";


        const originalOpen =
            xhr.open;


        xhr.open = function (
            method,
            url,
            ...rest
        ) {

            requestURL =
                String(url || "");


            return originalOpen.call(
                this,
                method,
                url,
                ...rest
            );
        };


        const originalSend =
            xhr.send;


        xhr.send = function (body) {

            this._iqcjRequestBody =
                body;


            return originalSend.call(
                this,
                body
            );
        };


        xhr.addEventListener(
            "load",

            function () {

                try {

                    // Gemini batchexecute traffic is intentionally
                    // not logged here. Gemini conversation capture
                    // is handled by the DOM capture below.

                    if (

                        (
                            isConversationRequest(
                                requestURL
                            )

                            ||

                            isClaudeConversationRequest(
                                requestURL
                            )
                        )

                        &&

                        typeof this.responseText
                            === "string"

                    ) {

                        sendConversation(
                            requestURL,
                            this.responseText
                        );
                    }

                } catch (error) {

                    console.log(
                        "IQChatJournal XHR hook error:",
                        error
                    );

                }

            }
        );


        return xhr;
    }


    WrappedXHR.prototype =
        OriginalXHR.prototype;


    window.XMLHttpRequest =
        WrappedXHR;


    // --------------------------------------------------
    // GEMINI DOM CAPTURE
    // --------------------------------------------------

    if (
        location.hostname.includes(
            "gemini.google.com"
        )
    ) {

        let lastGeminiMessageCount = 0;
        let captureTimer = null;


        function extractGeminiConversation() {

            const chatBlocks =
                document.querySelectorAll(
                    "user-query, model-response"
                );


            const messages = [];


            chatBlocks.forEach(
                (block) => {

                    const tag =
                        block.tagName.toLowerCase();

                    const role =
                        tag === "user-query"
                            ? "user"
                            : "model";


                    // --------------------------------
                    // GET GEMINI MESSAGE TEXT
                    // --------------------------------

                    let text =
                        block.innerText.trim();


                    // Older / collapsed Gemini user
                    // messages may have empty outer
                    // innerText. The actual text is
                    // inside .query-text.
                    if (!text) {

                        const queryText =
                            block.querySelector(
                                ".query-text"
                            );

                        if (queryText) {

                            text =
                                queryText.innerText.trim();

                        }

                    }


                    // Some Gemini model responses may
                    // expose their text through a
                    // markdown/content element.
                    if (!text) {

                        const content =
                            block.querySelector(
                                ".markdown, message-content"
                            );

                        if (content) {

                            text =
                                content.innerText.trim();

                        }

                    }


                    if (text) {

                        messages.push({
                            role: role,
                            content: text
                        });

                    }

                }
            );


            return messages;

        }


        function captureGeminiConversation() {

            try {

                const messages =
                    extractGeminiConversation();


                if (!messages.length) {

                    return;

                }

                
                // --------------------------------
                // GEMINI CONVERSATION ID
                // --------------------------------

                const geminiConversationId =
                    (
                        window.location.pathname.match(
                            /\/app\/([a-zA-Z0-9_-]+)/
                        ) || []
                    )[1] ||
                    null;


                const conversation =
                    JSON.stringify({
                        platform:
                            "gemini",

                        title:
                            document.title
                                .replace(
                                    " - Gemini",
                                    ""
                                ),

                        conversation_id:
                            geminiConversationId,

                        messages:
                            messages
                    });


                console.log(
                    "IQChatJournal: GEMINI CAPTURE",
                    messages.length,
                    "messages"
                );


                window.postMessage(
                    {
                        source:
                            "IQChatJournal",

                        type:
                            "CONVERSATION_RESPONSE",

                        platform:
                            "gemini",

                        url:
                            window.location.href,

                        text:
                            conversation
                    },
                    "*"
                );


            } catch (error) {

                console.log(
                    "IQChatJournal Gemini capture error:",
                    error
                );

            }

        }


        function scheduleGeminiCapture() {

            if (captureTimer) {

                clearTimeout(
                    captureTimer
                );

            }


            captureTimer =
                setTimeout(
                    () => {

                        captureTimer =
                            null;

                        captureGeminiConversation();

                    },
                    2000
                );

        }


        function checkGeminiDOM() {

            try {

                const userMessages =
                    document.querySelectorAll(
                        "user-query"
                    );

                const modelMessages =
                    document.querySelectorAll(
                        "model-response"
                    );


                const total =
                    userMessages.length +
                    modelMessages.length;


                if (
                    total !==
                    lastGeminiMessageCount
                ) {

                    lastGeminiMessageCount =
                        total;


                    console.log(
                        "IQChatJournal: GEMINI DOM CHANGE",
                        {
                            userMessages:
                                userMessages.length,

                            modelMessages:
                                modelMessages.length,

                            total:
                                total
                        }
                    );


                    scheduleGeminiCapture();

                }

            } catch (error) {

                console.log(
                    "IQChatJournal Gemini DOM diagnostic error:",
                    error
                );

            }

        }


        const geminiObserver =
            new MutationObserver(
                function () {

                    checkGeminiDOM();

                }
            );


        function startGeminiDOMObserver() {

            if (!document.body) {

                setTimeout(
                    startGeminiDOMObserver,
                    500
                );

                return;

            }


            geminiObserver.observe(
                document.body,
                {
                    childList: true,
                    subtree: true
                }
            );


            checkGeminiDOM();


            console.log(
                "IQChatJournal: GEMINI DOM CAPTURE READY"
            );

        }


        startGeminiDOMObserver();

    }

    
    // --------------------------------------------------
    // KIMI DOM CAPTURE
    // --------------------------------------------------

    if (
        location.hostname.includes(
            "kimi.com"
        ) ||
        location.hostname.includes(
            "kimi.ai"
        )
    ) {

        let lastKimiMessageCount = 0;
        let kimiCaptureTimer = null;


        function extractKimiConversation() {

            const chatBlocks =
                document.querySelectorAll(
                    ".chat-content-item"
                );


            const messages = [];


            chatBlocks.forEach(
                (block) => {

                    const classes =
                        block.classList;


                    let role = null;


                    if (
                        classes.contains(
                            "chat-content-item-user"
                        )
                    ) {

                        role = "user";

                    } else if (
                        classes.contains(
                            "chat-content-item-assistant"
                        )
                    ) {

                        role = "model";

                    }


                    if (!role) {
                        return;
                    }


                    const text =
                        block.innerText.trim();


                    if (!text) {
                        return;
                    }


                    messages.push({
                        role: role,
                        content: text
                    });

                }
            );


            return messages;

        }


        function captureKimiConversation() {

            try {

                const messages =
                    extractKimiConversation();


                if (!messages.length) {
                    return;
                }


                // --------------------------------
                // KIMI CONVERSATION ID
                // --------------------------------

                const kimiConversationId =
                    (
                        window.location.pathname.match(
                            /\/chat\/([a-zA-Z0-9_-]+)/
                        ) || []
                    )[1] ||
                    null;


                const conversation =
                    JSON.stringify({
                        platform:
                            "kimi",

                        title:
                            document.title
                                .trim(),

                        conversation_id:
                            kimiConversationId,

                        messages:
                            messages
                    });


                console.log(
                    "IQChatJournal: KIMI CAPTURE",
                    messages.length,
                    "messages"
                );


                window.postMessage(
                    {
                        source:
                            "IQChatJournal",

                        type:
                            "CONVERSATION_RESPONSE",

                        platform:
                            "kimi",

                        url:
                            window.location.href,

                        text:
                            conversation
                    },
                    "*"
                );


            } catch (error) {

                console.log(
                    "IQChatJournal Kimi capture error:",
                    error
                );

            }

        }


        function scheduleKimiCapture() {

            if (kimiCaptureTimer) {

                clearTimeout(
                    kimiCaptureTimer
                );

            }


            kimiCaptureTimer =
                setTimeout(
                    () => {

                        kimiCaptureTimer =
                            null;

                        captureKimiConversation();

                    },
                    1500
                );

        }


        function checkKimiDOM() {

            try {

                const messages =
                    document.querySelectorAll(
                        ".chat-content-item"
                    );


                const total =
                    messages.length;


                if (
                    total !==
                    lastKimiMessageCount
                ) {

                    lastKimiMessageCount =
                        total;


                    console.log(
                        "IQChatJournal: KIMI DOM CHANGE",
                        {
                            total:
                                total
                        }
                    );


                    scheduleKimiCapture();

                }

            } catch (error) {

                console.log(
                    "IQChatJournal Kimi DOM diagnostic error:",
                    error
                );

            }

        }


        const kimiObserver =
            new MutationObserver(
                function () {

                    checkKimiDOM();

                }
            );


        function startKimiDOMObserver() {

            if (!document.body) {

                setTimeout(
                    startKimiDOMObserver,
                    500
                );

                return;

            }


            kimiObserver.observe(
                document.body,
                {
                    childList: true,
                    subtree: true
                }
            );


            checkKimiDOM();


            console.log(
                "IQChatJournal: KIMI DOM CAPTURE READY"
            );

        }


        startKimiDOMObserver();

    }


    // --------------------------------------------------
    // QWEN DOM CAPTURE
    // --------------------------------------------------

    if (
        location.hostname.includes(
            "qwen.ai"
        )
    ) {

        let lastQwenMessageCount = 0;
        let qwenCaptureTimer = null;
        let qwenChatTitle = "";

        let qwenTitleByConversationId = {};

        try {
            chrome.storage.local.get(
                ["qwenTitleByConversationId"],
                (result) => {
                    if (result && result.qwenTitleByConversationId) {
                        qwenTitleByConversationId =
                            result.qwenTitleByConversationId;
                    }
                }
            );
        } catch (error) {
            // chrome.storage not available in this context - ignore.
        }

        function persistQwenTitleMap() {
            try {
                chrome.storage.local.set({
                    qwenTitleByConversationId:
                        qwenTitleByConversationId
                });
            } catch (error) {
                // ignore
            }
        }

        function getQwenConversationIdFromPath() {
            return (
                window.location.pathname.match(
                    /\/c\/([a-zA-Z0-9_-]+)/
                ) || []
            )[1] || null;
        }

        // When a sidebar item is clicked, poll for the URL to
        // actually change to a NEW conversation id, then resolve
        // that click's title IMMEDIATELY - independent of message
        // capture timing. This avoids a fast second click stomping
        // on a still-pending resolution from the first click.
        document.addEventListener(
            "click",
            function (event) {

                const link =
                    event.target.closest(
                        ".chat-item-drag-link"
                    );

                if (!link) {
                    return;
                }

                const titleEl =
                    link.querySelector(
                        ".chat-item-title-text"
                    );

                const clickedTitle =
                    titleEl
                        ? (titleEl.innerText || titleEl.textContent || "").trim()
                        : "";

                if (!clickedTitle) {
                    return;
                }

                const idBeforeClick =
                    getQwenConversationIdFromPath();

                let attempts = 0;
                const maxAttempts = 25; // ~5s at 200ms

                const pollTimer =
                    setInterval(
                        () => {

                            attempts++;

                            const currentId =
                                getQwenConversationIdFromPath();

                            const navigatedToNewChat =
                                currentId &&
                                currentId !==
                                    idBeforeClick;

                            if (navigatedToNewChat) {

                                qwenTitleByConversationId[
                                    currentId
                                ] = clickedTitle;
                                persistQwenTitleMap();

                                console.log(
                                    "IQChatJournal: Qwen title resolved via click:",
                                    currentId,
                                    "=",
                                    clickedTitle
                                );

                                clearInterval(pollTimer);

                            } else if (
                                attempts >=
                                maxAttempts
                            ) {

                                clearInterval(pollTimer);

                            }

                        },
                        200
                    );

            },
            true
        );

        window.getQwenChatTitle = function () {
            const element = document.querySelector(
                ".chat-item-title-text"
            );

            if (!element) {
                return "";
            }

            return (
                element.innerText ||
                element.textContent ||
                ""
            ).trim();
        }


        function extractQwenConversation() {

            const chatBlocks =
                document.querySelectorAll(
                    ".qwen-chat-message"
                );


            const messages = [];


            chatBlocks.forEach(
                (block) => {

                    const classes =
                        block.classList;


                    let role = null;


                    if (
                        classes.contains(
                            "qwen-chat-message-user"
                        )
                    ) {

                        role = "user";

                    } else if (
                        classes.contains(
                            "qwen-chat-message-assistant"
                        )
                    ) {

                        role = "model";

                    }


                    if (!role) {
                        return;
                    }


                    let text =
                        block.innerText.trim();


                    // Qwen adds this status text to
                    // assistant messages.
                    text = text.replace(
                        /^Thinking completed\s*/i,
                        ""
                    ).trim();


                    if (!text) {
                        return;
                    }


                    messages.push({
                        role: role,
                        content: text
                    });

                }
            );


            return messages;

        }


        function captureQwenConversation() {

            try {

                const messages =
                    extractQwenConversation();


                if (!messages.length) {
                    return;
                }


                // --------------------------------
                // QWEN CONVERSATION ID
                // --------------------------------

                const qwenConversationId =
                    (
                        window.location.pathname.match(
                            /\/c\/([a-zA-Z0-9_-]+)/
                        ) || []
                    )[1] ||
                    null;


                let resolvedTitle =
                    qwenTitleByConversationId[
                        qwenConversationId
                    ];

                if (!resolvedTitle) {

                    resolvedTitle =
                        getQwenChatTitle() ||
                        document.title.trim();

                    if (
                        qwenConversationId &&
                        resolvedTitle
                    ) {
                        qwenTitleByConversationId[
                            qwenConversationId
                        ] = resolvedTitle;
                    }

                }

                const conversation =
                    JSON.stringify({
                        platform:
                            "qwen",

                        title:
                            resolvedTitle,

                        conversation_id:
                            qwenConversationId,

                        messages:
                            messages
                    });


                console.log(
                    "IQChatJournal: QWEN CAPTURE",
                    messages.length,
                    "messages"
                );


                window.postMessage(
                    {
                        source:
                            "IQChatJournal",

                        type:
                            "CONVERSATION_RESPONSE",

                        platform:
                            "qwen",

                        url:
                            window.location.href,

                        text:
                            conversation
                    },
                    "*"
                );


            } catch (error) {

                console.log(
                    "IQChatJournal Qwen capture error:",
                    error
                );

            }

        }


        function scheduleQwenCapture() {

            if (qwenCaptureTimer) {

                clearTimeout(
                    qwenCaptureTimer
                );

            }


            qwenCaptureTimer =
                setTimeout(
                    () => {

                        qwenCaptureTimer =
                            null;

                        captureQwenConversation();

                    },
                    3500
                );

        }


        function checkQwenDOM() {

            try {

                qwenChatTitle = getQwenChatTitle();

                const messages =
                    document.querySelectorAll(
                        ".qwen-chat-message"
                    );


                const total =
                    messages.length;


                if (
                    total !==
                    lastQwenMessageCount
                ) {

                    lastQwenMessageCount =
                        total;


                    console.log(
                        "IQChatJournal: QWEN DOM CHANGE",
                        {
                            total:
                                total
                        }
                    );


                    scheduleQwenCapture();

                }

            } catch (error) {

                console.log(
                    "IQChatJournal Qwen DOM diagnostic error:",
                    error
                );

            }

        }


        const qwenObserver =
            new MutationObserver(
                function () {

                    checkQwenDOM();

                }
            );


        function startQwenDOMObserver() {

            if (!document.body) {

                setTimeout(
                    startQwenDOMObserver,
                    500
                );

                return;

            }


            qwenObserver.observe(
                document.body,
                {
                    childList: true,
                    subtree: true
                }
            );


            checkQwenDOM();


            console.log(
                "IQChatJournal: QWEN DOM CAPTURE READY"
            );

        }


        startQwenDOMObserver();

    }


    // --------------------------------------------------
    // DEEPSEEK DOM CAPTURE
    // --------------------------------------------------

    if (
        location.hostname.includes(
            "deepseek.com"
        )
    ) {

        let lastDeepSeekMessageCount = 0;
        let deepSeekCaptureTimer = null;

        function getDeepSeekChatInfo() {

            const currentConversationId =
                (
                    window.location.pathname.match(
                        /\/a\/chat\/s\/([a-zA-Z0-9-]+)/
                    ) || []
                )[1] || null;

            if (!currentConversationId) {
                return {
                    title: "",
                    conversation_id: null
                };
            }

            const links =
                document.querySelectorAll(
                    'a[href*="/a/chat/s/"]'
                );

            for (const link of links) {

                const match =
                    link.getAttribute("href")
                        ?.match(
                            /\/a\/chat\/s\/([a-zA-Z0-9-]+)/
                        );

                if (
                    !match ||
                    match[1] !==
                        currentConversationId
                ) {
                    continue;
                }

                const titleElement =
                    link.querySelector(
                        'div.c08e6e93'
                    );

                if (!titleElement) {
                    continue;
                }

                const title =
                    (
                        titleElement.innerText ||
                        titleElement.textContent ||
                        ""
                    ).trim();

                if (title) {
                    return {
                        title: title,
                        conversation_id:
                            currentConversationId
                    };
                }
            }

            return {
                title: "",
                conversation_id:
                    currentConversationId
            };
        }

        function extractDeepSeekConversation() {

            const blocks =
                document.querySelectorAll(
                    ".ds-message"
                );

            const messages = [];

            blocks.forEach(
                (block) => {

                    const userContent =
                        block.querySelector(
                            ".fbb737a4"
                        );

                    const assistantContent =
                        block.querySelector(
                            ".ds-assistant-message-main-content"
                        );

                    if (userContent) {

                        const text =
                            userContent.innerText.trim();

                        if (text) {
                            messages.push({
                                role: "user",
                                content: text
                            });
                        }

                        return;
                    }

                    if (assistantContent) {

                        const text =
                            assistantContent.innerText.trim();

                        if (text) {
                            messages.push({
                                role: "assistant",
                                content: text
                            });
                        }
                    }
                }
            );

            return messages;
        }

        function captureDeepSeekConversation() {

            try {

                const info =
                    getDeepSeekChatInfo();

                const messages =
                    extractDeepSeekConversation();

                const deepSeekConversationId =
                    (
                        window.location.pathname.match(
                            /\/a\/chat\/s\/([a-zA-Z0-9-]+)/
                        ) || []
                    )[1] ||
                    info.conversation_id;

                if (!messages.length) {
                    return;
                }

                const conversation =
                    JSON.stringify({
                        platform:
                            "deepseek",

                        title:
                            info.title ||
                            document.title
                                .replace(
                                    " - DeepSeek",
                                    ""
                                )
                                .trim(),

                        conversation_id:
                            deepSeekConversationId,

                        messages:
                            messages
                    });

                console.log(
                    "IQChatJournal: DEEPSEEK CAPTURE",
                    messages.length,
                    "messages",
                    info
                );

                window.postMessage(
                    {
                        source:
                            "IQChatJournal",

                        type:
                            "CONVERSATION_RESPONSE",

                        platform:
                            "deepseek",

                        url:
                            window.location.href,

                        text:
                            conversation
                    },
                    "*"
                );

            } catch (error) {

                console.log(
                    "IQChatJournal DeepSeek capture error:",
                    error
                );
            }
        }

        function scheduleDeepSeekCapture() {

            if (deepSeekCaptureTimer) {
                clearTimeout(
                    deepSeekCaptureTimer
                );
            }

            deepSeekCaptureTimer =
                setTimeout(
                    () => {

                        deepSeekCaptureTimer =
                            null;

                        captureDeepSeekConversation();

                    },
                    2000
                );
        }

        function checkDeepSeekDOM() {

            try {

                const messages =
                    document.querySelectorAll(
                        '[class*="fbb737a4"]'
                    );

                const total =
                    messages.length;

                if (
                    total !==
                    lastDeepSeekMessageCount
                ) {

                    lastDeepSeekMessageCount =
                        total;

                    console.log(
                        "IQChatJournal: DEEPSEEK DOM CHANGE",
                        {
                            total:
                                total,
                            chat:
                                getDeepSeekChatInfo()
                        }
                    );

                    scheduleDeepSeekCapture();
                }

            } catch (error) {

                console.log(
                    "IQChatJournal DeepSeek DOM diagnostic error:",
                    error
                );
            }
        }

        const deepSeekObserver =
            new MutationObserver(
                function () {
                    checkDeepSeekDOM();
                }
            );

        function startDeepSeekDOMObserver() {

            if (!document.body) {

                setTimeout(
                    startDeepSeekDOMObserver,
                    500
                );

                return;
            }

            deepSeekObserver.observe(
                document.body,
                {
                    childList: true,
                    subtree: true
                }
            );

            checkDeepSeekDOM();

            console.log(
                "IQChatJournal: DEEPSEEK DOM CAPTURE READY"
            );
        }

        startDeepSeekDOMObserver();
    }


    // --------------------------------------------------
    // READY
    // --------------------------------------------------

    window.postMessage(
        {
            source: "IQChatJournal",
            type: "HOOK_READY"
        },
        "*"
    );

})();