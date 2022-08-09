// content.js
(function(window, undefined) {
    const data = {
        width: 128,
        height: 64,
        available: null,
        flag: null,
        config: {
            subtree: true,
            attributes: false,
            childList: true,
            characterData: false
        },
        global_observer: new MutationObserver(manageObserver),
        oc: document.createElement('canvas'),
        captcha: {
            aInternal: '',
            aListener: function(val) {},
            set a(val) {
                this.aInterval = val;
                this.aListener(val);
            },
            get(a) {
                return this.aInterval;
            },
            registerListener: function(listener) {
                this.aListener = listener;
            }
        },
        RGBimgarr: new Uint8Array(128 * 64 * 1),
    };

    const DOM = {
        captcha_key: 'big_text',
        submit_btn_1: 'FlatButton__content',
        passWord: 'pass',
        popup: 'box_layout',
    }
    Object.freeze(DOM);

    const MESSAGES = {
        unreachable: 'unreachable',
        power_off: 'power_off',
        power_on: 'power_on',
        ping: '?',
    }
    Object.freeze(MESSAGES);

    async function base64_arraybuffer(data) {
        // https://stackoverflow.com/a/66046176
        const base64url = await new Promise((r) => {
            const reader = new FileReader()
            reader.onload = () => r(reader.result)
            reader.readAsDataURL(new Blob([data]))
        })
        return base64url.split(",", 2)[1]
    }

    async function wait_image(click = true) {
        let img;
        for (const captchaForm of document.getElementsByClassName("box_title")) {
            if (captchaForm.textContent == 'Введите код с картинки')
            {
                img = document.querySelector(".captcha > div:nth-child(1) > img:nth-child(1)")
            }
        }
        
        if (img == null) return true;
        if (img.src[0] !== 'd') {
            // Download image in background
            chrome.runtime.sendMessage({
                captchaURL: img.src
            });
            img.src = '';
            await (new Promise(r => {
                data.captcha.registerListener(r)
            })).then((newSrc) => {
                img.src = newSrc;
            });
        }
        if (!img.complete) {
            await (new Promise(r => {
                img.onload = r
            })).then();
        }
        return await recognize_captcha(img, click);
    }


    async function recognize_captcha(img, click) {
        const captchaForm = document.getElementsByClassName(DOM.popup);
        let submit_button = document.getElementsByClassName(DOM.submit_btn_1);
        let placeholder;
        let num;
        if (captchaForm.length) {
            if (captchaForm[0].getElementsByTagName('button')[1] === undefined) {
                submit_button = captchaForm[2].getElementsByTagName('button')[1];
                placeholder = document.getElementsByClassName('captcha')[0].getElementsByTagName('input')[0];
            } else {
                
                for (const captchaFormXD of document.getElementsByClassName("box_title")) {
                    if (captchaFormXD.textContent == 'Введите код с картинки')
                    {
                        placeholder = document.querySelector("input.big_text[placeholder='Введите код'][maxlength='7']");
                        submit_button = captchaFormXD.parentNode.parentNode.getElementsByTagName('button')[1];
                    }
                }
            }

        } else {
            placeholder = document.querySelector("input.big_text[placeholder='Введите код'][maxlength='7']");
            if (submit_button.length) {
                submit_button = submit_button[1];
            } else {
                submit_button = document.getElementsByClassName(DOM.submit_btn_1)[2]
            }
        }
        let bool_recognized = true;
        const octx = data.oc.getContext('2d');
        octx.drawImage(img, 0, 0, data.width, data.height);

        // Run model with Tensor inputs in background and get the result.
        const arr = octx.getImageData(0, 0, data.width, data.height).data;
        for (let i = 0, counter = 0, length = data.width * data.height * 4; i < length; i += 4) {
            data.RGBimgarr[counter] = arr[i];
            counter++;
        }
        chrome.runtime.sendMessage(await base64_arraybuffer(data.RGBimgarr.buffer));
        await (new Promise(r => {
            data.captcha.registerListener(r)
        })).then((captcha) => {
            if (captcha === MESSAGES.unreachable) {
                bool_recognized = false;
            } else {
                placeholder.value = captcha;
                console.log(captcha);
            }
        });
        const captcha = placeholder.value;
        if (!bool_recognized)
            return bool_recognized;
        if (click) {
            submit_button.click();
            try {
                const captcha_img = document.querySelector(".captcha > div:nth-child(1) > img:nth-child(1)")
                if (captcha_img.length) {
                    if (captcha_img.src[0] !== 'd') {
                        bool_recognized = false;
                    }
                }
            } catch (e) {
                console.log(e);
                bool_recognized = true;
            }
            return bool_recognized;
        }
        return true;
    }

    chrome.runtime.sendMessage({
        data: MESSAGES.ping
    });

    async function iconCallback(request, sender, sendResponse) {
        if (request.captcha) {
            data.captcha.a = request.captcha;
            return;
        } else if (request.base64) {
            data.captcha.a = request.base64;
            return;
        } else if (request.message === MESSAGES.power_on) {
            data.available = true;
            data.flag = true;
            data.oc.width = data.width;
            data.oc.height = data.height;
            manageObserver(null);
            data.global_observer.observe(document.body, data.config);
        } else if (request.message === MESSAGES.power_off) {
            data.available = true;
            data.flag = true;
        }
    }

    chrome.runtime.onMessage.addListener(iconCallback);

    async function manageObserver(mutations) {
        for await (const element of document.getElementsByClassName("box_title")) {
            if (element.textContent === "Привязка номера телефона") {
                if (document.getElementById("validation_skip")) {
                    document.getElementById("validation_skip").click();
                        await new Promise(r => setTimeout(r, 500));
                }
            }
        }
        if (document.getElementsByClassName("captcha").length === 0){
            data.flag = true;
            return;
        }
        if (data.flag && data.available) {
            const click = document.getElementsByName(DOM.passWord)[0] ? false : true;
            try {
                data.available = false;
                data.flag = false;
                var i = 0;
                while (i++ < 7) {
                    try {
                        if (await wait_image(click)) break;
                    } catch (e) {
                        console.log(e);
                        break;
                    }
                }
                if (i >= 7)
                    chrome.runtime.sendMessage({
                        data: MESSAGES.ping
                    });
            } catch (e) {
                console.log(e);
            }
            data.available = true;
            data.flag = true;
        }
    }
})(this);
