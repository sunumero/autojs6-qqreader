auto.waitFor();
console.show();
console.setExitOnClose().show();
console.build({ touchable: false }).show();

console.log("QQ阅读自动脚本已启动…");

// =========================================================
// 全局配置与变量
// =========================================================

const PKG = "com.qq.reader";
const ACT_MAIN = "com.qq.reader.activity.MainFlutterActivity";
const ACT_READER = "com.qq.reader.activity.ReaderPageActivity";
const ACT_WELFARE = "com.qq.reader.activity.WebBrowserForFullScreenContents";
const ACT_AUDIO = "com.qq.reader.activity.flutter.FeedAudioFlutterActivity";
const ACT_AD = "com.qq.e.tg.RewardvideoPortraitADActivity";
const ACT_INAPP_AD = "com.qq.e.tg.ADActivity";

const AD_WAIT = 30 * 1000;
let originalVolume = 0;

const SIGN_KEYWORDS = ["X", "x", "我知道了", "知道了", "我已知晓"];
const AD_CLOSE_KEYS = ["关闭", "关闭广告", "跳过", "skip", "Skip", "x", "X", "广告", "close", "知道了"];

// =========================================================
// 工具函数
// =========================================================
function waitActivity(act, timeout = 8000) {
    return waitForActivity(act, timeout);
}

function clickCenter(obj) {
    if (!obj) return false;
    const b = obj.bounds();
    click(b.centerX(), b.centerY());
    return true;
}

function findClickText(t, timeout = 1500) {
    const o = className('android.widget.TextView').text(t).findOne(timeout);
    if (!o) return false;
    console.log("找到" + t + "，正在执行");
    return click(o);
}

function findClickDesc(d, timeout = 1500) {
    const o = className('android.view.View').descContains(d).findOne(timeout);
    if (!o) return false;
    return clickCenter(o);
}


function findWatchButton(key ,maxSwipe) {
    for (let i = 0; i < maxSwipe; i++) {

        let btn = className("android.widget.TextView").text(key).findOne(800);
        if (btn) return btn;  // 找到了
        sleep(300);
        click(btn);

        let bottom = className("android.widget.TextView").text("回到顶部").findOne(500);
        if (bottom) {
            console.log("[WATCH] 已到页面底部，停止查找");
            return null;
        }

        // 未找到 → 继续向下滑动
        swipe(device.width / 2, device.height * 0.8,
              device.width / 2, device.height * 0.3, 400);

        sleep(600);
    }
    return null; // 翻到尽头仍旧没有
}

function scrollToTop(maxTimes = 10) {
    console.log("[WELFARE] 回滚到页面顶部…");

    let lastTop = -1;
    for (let i = 0; i < maxTimes; i++) {


        let topObj = className("android.widget.TextView").text("规则").depth(12).findOne(500);
        if (topObj) {
            let topY = topObj.bounds().top;
            if (lastTop === topY) {
                // 已经不能再往下拉，说明到顶部了
                console.log("[WELFARE] 页面已在顶部");
                return;
            }
            lastTop = topY;
        }

        // 下滑（往下拉页面，使页面回到顶端）
        swipe(device.width / 2, device.height * 0.2,
              device.width / 2, device.height * 0.9, 400);

        sleep(600);
    }

    console.log("[WELFARE] 已尝试 maxTimes 次回滚，可能已到顶部");
}



// =========================================================
// 音量管理
// =========================================================
function initVolume() {
    try {
        originalVolume = device.getMusicVolume();
        device.setMusicVolume(0);
        console.log("[音量] 已静音");
    } catch (e) {
        console.log("[音量] 设置静音失败：" + e);
    }
}

function restoreVolume() {
    try {
        device.setMusicVolume(originalVolume);
        console.log("[音量] 已恢复原音量");
    } catch (e) {
        console.log("[音量] 恢复失败：" + e);
    }
}

// =========================================================
// App 入口流程
// =========================================================
function ensureApp() {
    if (currentPackage() !== PKG) {
        console.log("启动 QQ 阅读…");
        app.launchPackage(PKG);
    }
    waitActivity(ACT_MAIN, 8000);
}

function enterBookshelf() {
    console.log("进入书架…");
    let target = className('android.view.View').desc("书架").findOne(8000);
    if (!target) return false;
    clickCenter(target);
    sleep(2000);
    return true;
}

function enterWelfare() {
    console.log("进入福利中心…");

    if (currentActivity() === ACT_WELFARE) {
        console.log("当前已在福利中心，无需重复进入");
        return true;
    }

    enterBookshelf();

    const keys = ["赠币", "更多惊喜奖励"];

    for (let i = 0; i < 10; i++) {
        for (let k of keys) {
            if (findClickDesc(k, 800)) {
                console.log("已进入福利中心入口");
                waitActivity(ACT_WELFARE, 8000);
                if (currentActivity() === ACT_WELFARE) {
                    console.log("成功进入福利中心");
                    return true;
                } else {
                    console.log("[WARN] 点击入口后未成功进入福利界面");
                    return false;
                }
            }
        }
        sleep(500);
    }

    console.log("[WARN] 找不到福利中心入口");
    return false;
}

// =========================================================
// 弹窗处理
// =========================================================
function closeSignPopup() {
    console.log("检测签到弹窗…");
    for (let k of SIGN_KEYWORDS) {
        if (findClickText(k, 500)) {
            console.log("已关闭签到弹窗: " + k);
            sleep(500);
            return true;
        }
    }
    return false;
}

function closeAdByPos() {
    let current = id('content').depth(2).findOne(5000);
    if (!current) {exit();}

    const path = [1, 1, 1, 1, 1, 1, 4, 1];

    for (let i = 0; i < path.length; i++) {
        let children = current.children();
        if (!children || children.empty()) { exit(); }
        let targetDO = path[i];
        let next = null;
        for (let j = 0; j < children.size(); j++) {
            let child = children.get(j);
            if (child.drawingOrder() === targetDO) {
                next = child;
                break;
            }
        }

        if (!next) { exit(); }

        current = next;
    }
    clickCenter(current);
    console.log("尝试点击广告右上角关闭按钮");
}

// =========================================================
// ★★★ 新广告模块（已完全按你的要求替换）
// =========================================================

// 广告激活区
const AD_ACTIVATE_RECT = {
    x1: 29,  y1: 1679,
    x2: 1123, y2: 2309
};

// ★ 替换后的 clickAdActivate()
function clickAdActivate() {
    let x = (AD_ACTIVATE_RECT.x1 + AD_ACTIVATE_RECT.x2) / 2;
    let y = (AD_ACTIVATE_RECT.y1 + AD_ACTIVATE_RECT.y2) / 2;
    console.log(`[AD] 点击激活区 (${x}, ${y})`);
    click(x, y);
    sleep(800);
}

// ★ 新增：统一广告判断
function detectAndHandleAdUnified() {
    console.log("[AD] 判断广告类型…");

    if (waitActivity(ACT_INAPP_AD, 3000)) {
        console.log("[AD] 内部广告 ACT_INAPP_AD");
        return handleAdAndReturn();
    }

    if (currentPackage() !== PKG) {
        console.log("[AD] 外部广告（跳转第三方APP）");
        return handleAdAndReturn();
    }

    console.warn("[AD] 未识别到广告播放页面");
    return false;
}

// ★ 新增：播放等待
function handleAdAndReturn() {
    console.log("[AD] 继续广告播放30秒…");
    sleep(AD_WAIT);

    return backToAdAndClose();
}

// ★ 新增：back → 回 ACT_AD → closeAdByPos
function backToAdAndClose() {
    console.log("[AD] 尝试返回 ACT_AD…");

    for (let i = 0; i < 6; i++) {
        if (currentActivity() === ACT_AD) {
            console.log("[AD] 已回到 ACT_AD");
            break;
        }
        back();
        sleep(500);
    }

    if (currentActivity() !== ACT_AD) {
        console.log("[AD-WARN] 无法回到 ACT_AD");
        return false;
    }

    console.log("[AD] 使用 closeAdByPos() 关闭广告");
    closeAdByPos();

    return true;
}

// =========================================================
// ★ 观看广告任务（使用统一广告流程）
// =========================================================
function doWatchAd() {
    console.log("开始执行观看广告任务（可重复执行）…");

    if (!enterWelfare()) return;

    // 连续执行，直到没有“去观看”
    while (true) {
        if(!findClickText("去观看" ,500)){
            scrollToTop();
            let btn = findWatchButton("去观看", 8);  // ⭐ 改成使用翻页查找
            if (!btn) {
                console.log("[WATCH] 福利中心没有更多“去观看”，退出广告循环");
                break;
            }
        }

        sleep(1200);

        // 进入广告壳页
        if (!waitActivity(ACT_AD, 6000)) {
            console.log("[WATCH] 点击后未进入广告壳页 ACT_AD，跳过一次");
            continue;
        }

        clickAdActivate();

        detectAndHandleAdUnified();

        console.log("[WATCH] 广告一次完成，返回福利中心重新检测…");

        enterWelfare();
        sleep(1200);
    }

    console.log("[WATCH] 所有广告已全部观看完成");
}



// =========================================================
// 听书任务
// =========================================================
function doListen() {
    console.log("执行听书任务…");

    if (!enterWelfare()) return;

    if(!findClickText("去听书" ,500)){
        scrollToTop();
        findWatchButton("去听书", 8);
    }

    if (!waitActivity(ACT_AUDIO, 8000)) {
        console.log("[LISTEN] 未进入听书专区");
        return;
    }

    let play = descContains("播至").findOne(6000);
    if (!play) {
        console.log("[LISTEN] 找不到 播至");
        return;
    }

    clickCenter(play);
    sleep(2000);

    const TOTAL_MIN = 30;
    for (let m = 1; m <= TOTAL_MIN; m++) {
        console.log(`听书中… ${m}/${TOTAL_MIN} 分钟`);
        sleep(60 * 1000);
    }

    back();
    sleep(1500);

    let cancel = className('android.view.View').desc("取消").findOne(1500);
    if (cancel) cancel.click();

    back();
    sleep(1500);

    let claim = textContains("领取").findOne(3000);
    if (claim) {
        clickCenter(claim);
        console.log("已领取听书奖励");
    }
}

// =========================================================
// 主流程
// =========================================================
function main() {
    initVolume();

    ensureApp();
    sleep(1500);

    enterBookshelf();

    enterWelfare();
    sleep(1500);
    closeSignPopup();

    doWatchAd();
    sleep(2000);

    doListen();

    console.log("任务结束，开始退出");

    while (true) {
        let exitBtn = text("退出").id("sureButton").findOne(600);
        if (exitBtn) {
            clickCenter(exitBtn);
            break;
        }
        back();
        sleep(500);
    }

    restoreVolume();
    console.log("脚本执行完毕");
}

main();
