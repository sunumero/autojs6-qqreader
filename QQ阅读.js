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
    const o = text(t).findOne(timeout);
    if (!o) return false;
    return clickCenter(o);
}

function findClickDesc(d, timeout = 1500) {
    const o = className('android.view.View').descContains(d).findOne(timeout);
    if (!o) return false;
    return clickCenter(o);
}

function pickupAndClick(selector) {
    let o = pickup(selector);
    if (!o) return false;
    o.show();
    sleep(300);
    clickCenter(o);
    return true;
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
    enterBookshelf();

    const keys = ["赠币", "更多惊喜奖励"];

    for (let i = 0; i < 10; i++) {
        for (let k of keys) {
            if (findClickDesc(k, 800)) {
                console.log("已进入福利中心入口");
                waitActivity(ACT_WELFARE, 8000);
                return true;
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
    // 起点：id='content' 且 depth=2 的控件
    let current = id('content').depth(2).findOne(5000);

    if (!current) {exit();}

    // 从 depth=2 出发，向下走 8 层到 depth=10
    // path[i] 表示 depth=2+i+1 层控件的 drawingOrder（即子节点的 drawingOrder）
    const path = [1, 1, 1, 1, 1, 1, 4, 1]; // 8 steps: depth3 → depth10

    for (let i = 0; i < path.length; i++) {
        let children = current.children();
        if (!children || children.empty()) { exit();}
        let targetDO = path[i];
        let next = null;
        for (let j = 0; j < children.size(); j++) {
            let child = children.get(j);
            if (child.drawingOrder() === targetDO) {
                next = child;
                break;
            }
        }

        if (!next) {exit();}

        current = next;
    }
    clickCenter(current);
    console.log("尝试点击广告右上角关闭按钮");
}

// =========================================================
// 广告处理
// =========================================================
function handleInAppAd() {
    if (!waitActivity(ACT_INAPP_AD, 3000)) return false;

    console.log("进入内部广告，等待30秒…");
    sleep(AD_WAIT);

    return true;
}

function handleExternalAd() {
    if (currentPackage() !== PKG) {
        console.log("跳转外部广告，等待30秒…");
        sleep(AD_WAIT);
        return true;
    }
    return false;
}

// =========================================================
// **观看广告任务**
// =========================================================
function doWatchAd() {
    console.log("执行观看广告任务…");

    if (!enterWelfare()) return;

    if (!pickupAndClick(text("去观看"))) {
        console.log("[WATCH] 找不到去观看");
        return;
    }

    sleep(1500);

    // 进入广告页
    if (!waitActivity(ACT_AD, 6000)) {
        console.log("[WATCH] 未进入广告页");
        return;
    }

    if (!handleInAppAd()) handleExternalAd();

    console.log("尝试关闭广告…");
    for (let i = 0; i < 3; i++) {
        // 先快速检查是否已经到达目标页面
        if (currentActivity() === ACT_WELFARE) {
            console.log("已进入福利中心，停止关闭广告");
            break;
        }

        closeAdByPos();
        sleep(1000);
    }
    console.log("广告任务完成");
}

// =========================================================
// **听书任务（新增计时循环）**
// =========================================================
function doListen() {
    console.log("执行听书任务…");

    if (!enterWelfare()) return;

    if (!pickupAndClick(text("去听书"))) {
        console.log("[LISTEN] 找不到 去听书");
        return;
    }

    if (!waitActivity(ACT_AUDIO, 8000)) {
        console.log("[LISTEN] 未进入听书专区");
        return;
    }

    // 进入播放界面
    let play = descContains("播至").findOne(6000);
    if (!play) {
        console.log("[LISTEN] 找不到 播至");
        return;
    }

    clickCenter(play);
    sleep(2000);

    // ====== ★ 核心新增：听书 30 分钟计时循环 ======
    const TOTAL_MIN = 30;
    for (let m = 1; m <= TOTAL_MIN; m++) {
        console.log(`听书中… ${m}/${TOTAL_MIN} 分钟`);
        sleep(60 * 1000);
    }

    console.log("30 分钟听书完成，返回…");
    back();
    sleep(2000);

    let cancel = className('android.view.View').desc("取消").findOne(1500);
    if (cancel) cancel.click();
    sleep(1000);

    back();
    sleep(2000);

    let claim = textContains("领取").findOne(3000);
    if (claim) {
        clickCenter(claim);
        console.log("已领取听书奖励");
    } else {
        console.log("[LISTEN] 未找到领取按钮");
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
