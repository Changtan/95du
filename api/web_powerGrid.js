// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: bolt;
/**
 * 组件作者: 95度茅台
 * 组件名称: 南方电网
 * 组件版本: Version 1.0.1
 * 发布时间: 2024-05-06
 */

async function main(family) {
  const fm = FileManager.local();
  const mainPath = fm.joinPath(fm.documentsDirectory(), '95du_powerGrid');
  const rootUrl = 'https://raw.githubusercontent.com/95du/scripts/master';
  const alipayUrl = 'alipays://platformapi/startapp?appId=2021001164644764';
  
  const getCachePath = (dirName) => fm.joinPath(mainPath, dirName);
  
  const [ settingPath, cacheImg, cacheStr ] = [
    'setting.json',
    'cache_image',
    'cache_string',
  ].map(getCachePath);
  
  /**
   * 读取储存的设置
   * @returns {object} - 设置对象
   */
  const getBotSettings = (file) => {
    if (fm.fileExists(file)) {
      return { avatar, useCache, count = 0, token, gap, location, progressWidth, radius } = JSON.parse(fm.readString(file));
    }
    return {};
  };
  
  const setting = await getBotSettings(settingPath);
  
  /**
   * 存储当前设置
   * @param { JSON } string
   */
  const writeSettings = async (setting) => {
    fm.writeString(settingPath, JSON.stringify(setting, null, 2));
    console.log(JSON.stringify(
      setting, null, 2
    ))
  };
  
  // 获取随机数组元素
  const getRandomItem = async (array) => array[Math.floor(Math.random() * array.length)];
  
  /**
   * 该函数获取当前的年份和月份
   * @returns {Promise}
   */
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const currentYear = month === '01' ? year - 1 : year;
  
  /**  
  * 弹出通知
  * @param {string} title
  * @param {string} body
  * @param {string} url
  * @param {string} sound
  */
  const notify = (title, body, url, opts = {}) => {
    const n = Object.assign(new Notification(), { title, body, sound: 'event', ...opts });
    if (url) n.openURL = url;
    n.schedule();
  };
  
 /**
   * 获取背景图片存储目录路径
   * @returns {string} - 目录路径
   */
  const getBgImage = () => fm.joinPath(cacheImg, Script.name());
  
  // 图片遮罩
  async function shadowImage(img) {
    let ctx = new DrawContext()
    ctx.size = img.size
    ctx.drawImageInRect(img, new Rect(0, 0, img.size['width'], img.size['height']))
    ctx.setFillColor(new Color("#000000", Number(setting.masking)));
    ctx.fillRect(new Rect(0, 0, img.size['width'], img.size['height']))
    return await ctx.getImage()
  };
  
  /**
   * 读取和写入缓存的文本和图片数据
   * @param {object} options
   * @param {number}  - number
   * @returns {object} - Object
   */
  const useFileManager = ({ cacheTime, type } = {}) => {
    const basePath = type ? cacheStr : cacheImg;
    return {
      read: (name) => {
        const path = fm.joinPath(basePath, name);
        if (fm.fileExists(path)) {
          if (hasExpired(path) > cacheTime || !useCache) {  
            fm.remove(path);
          } else if (useCache) {  
            return type ? JSON.parse(fm.readString(path)) : fm.readImage(path);
          }
        }
      },
      write: (name, content) => {
        const path = fm.joinPath(basePath, name);
        type ? fm.writeString(path, JSON.stringify(content)) : fm.writeImage(path, content);
      }
    };
  
    function hasExpired(filePath) {
      const createTime = fm.creationDate(filePath).getTime();
      return (Date.now() - createTime) / (60 * 60 * 1000);
    }
  };
  
  /**
   * 获取网络图片并使用缓存
   * @param {Image} url
   */
  const getCacheImage = async (name, url) => {
    const cache = useFileManager({ cacheTime : 240 });
    const image = cache.read(name);
    if (image) return image;
    const img = await new Request(url).loadImage();
    cache.write(name, img);
    return img;
  };
  
  /**
   * 获取 POST JSON 字符串
   * @param {string} string
   * @returns {object} - JSON
   */
  const getCacheString = async (jsonName, jsonUrl, requestBody) => {
    const cache = useFileManager({ cacheTime: 12, type: true });
    const json = cache.read(jsonName);
    if (json) return json;
    
    const response = await makeRequest(jsonUrl, requestBody);
    const { sta } = response;
    if (sta == 00) {
      cache.write(jsonName, response);
    }
    return response;
  }; 
  
  /**
   * 获取请求数据
   * @param {string} - string
   * @returns {image} - url
   */
  const makeRequest = async (url, requestBody) => {
    const req = new Request(url);
    req.method = 'POST';
    req.headers = {
      'x-auth-token': token,
      'Content-Type': 'application/json;charset=utf-8'
    }
    req.body = JSON.stringify(requestBody);
    return await req.loadJSON();
  };
  
  // 用户信息
  const getUserInfo = async () => {
    const url = 'https://95598.csg.cn/ucs/ma/zt/eleCustNumber/queryBindEleUsers';
    const { sta, data } = await getCacheString('userInfo.json', url);
    if (sta == 00) {
      const outputNextIndex = (num, data) => (num + 1) % data.length;
      setting.count = outputNextIndex(count, data);
      writeSettings(setting);
      return data[setting.count];
    } else {
      notify('南网在线', 'Token已过期，请重新获取。⚠️');
    }
  };
  
  // 月用电量
  const getMonthData = async (areaCode, eleCustId) => {
    const pointResponse = await getCacheString(
      `queryMeteringPoint_${count}.json`,
      'https://95598.csg.cn/ucs/ma/zt/charge/queryMeteringPoint', {
      areaCode,
      eleCustNumberList: [{ areaCode, eleCustId }]
    });
    // totalPower & yesterday
    if (pointResponse.sta == 00) {
      const { meteringPointId } = pointResponse?.data[0];
      const monthResponse = await getCacheString(`queryDayElectricByMPoint_${count}.json`, 'https://95598.csg.cn/ucs/ma/zt/charge/queryDayElectricByMPoint', {
        eleCustId,
        areaCode,
        yearMonth: year + month,
        meteringPointId
      });
      return monthResponse.data;
    }
  };
  
  // 账单
  const getEleBill = async (areaCode, eleCustId) => {
    const response = await getCacheString(  
      `selectElecBill_${count}.json`,
      'https://95598.csg.cn/ucs/ma/zt/charge/selectElecBill', {
      electricityBillYear: currentYear,
      areaCode,
      eleCustId
    });
    if (response.sta == 00) {
      const totalArray = response.data.billUserAndYear;
      const eleBill = totalArray[0];
      const lastMonth = eleBill.electricityBillYearMonth.replace(/^(\d{4})(\d{2})$/, '$1-$2');
      return { lastMonth, ...eleBill, totalArray };
    }
  };
  
  // 余额
  const getUserBalance = async (areaCode, eleCustId) => {
    const res = await getCacheString(`queryUserAccountNumberSurplus_${count}.json`, 'https://95598.csg.cn/ucs/ma/zt/charge/queryUserAccountNumberSurplus', {
      areaCode,
      eleCustId
    });
    return res.sta == 00 ? res.data[0].balance : '0.00';
  };
  
  // 提取数据
  const {  
    userName: name = '用户名',
    eleCustNumber: number = '070100',
    areaCode,
    bindingId: eleCustId
  } =  await getUserInfo() || {};
  
  const balance = await getUserBalance(areaCode, eleCustId);
  
  // totalPower & Yesterday
  const { totalPower, result } = await getMonthData(areaCode, eleCustId) || { totalPower: '0.00', result: [] };
  const ystdayPower = result.length > 0 ? result.pop().power : '0.00';
  const beforeYesterday = result.length > 0 ? `${result.pop().power} °` : '0.00 °';
  
  const {
    lastMonth = `${year}-${month}`,
    totalArray,
    totalPower: total = '0.00',  
    totalElectricity = '0.00',   
    arrears = '0', 
    isArrears = '0'
  } = await getEleBill(areaCode, eleCustId) || {};
  
  // 欠费时每12小时通知一次
  const arrearsNotice = () => {
    const pushTime = Date.now() - setting.updateTime;
    const duration = pushTime % (24 * 3600 * 1000);
    const hours_duration = Math.floor(duration / (3600 * 1000));
    if (hours_duration >= 12 && isArrears == 1) {
      setting.updateTime = Date.now()
      writeSettings(setting);
      notify('用电缴费通知 ‼️', `${name}，户号 ${number}` + `\n上月用电 ${total} 度 ，待缴电费 ${arrears} 元`);
    }
  };
  
  // 创建图表(每月用量)  
  const getTotalPower = (data) => {
    const total = data.map(entry => entry.totalElectricity).reverse();
    while (total?.length < 12) total.push(0);
    return total?.slice(0, 12);
  };
  
  // 填充矩形
  const fillRect = (ctx, x, y, width, height, radius, color) => {
    const path = new Path();
    path.addRoundedRect(new Rect(x, y, width, height), radius, radius);
    ctx.addPath(path);
    ctx.setFillColor(color);
    ctx.fillPath();
  };
  
  // 图表绘制函数
  const createChart = (displayData, n, barColor) => {
    const chartHeight = 50;
    const paddingTop = 35;
    
    const ctx = new DrawContext();
    ctx.size = new Size(n * 18 - 10, chartHeight + paddingTop);
    ctx.opaque = false;
    ctx.respectScreenScale = true;
    
    const max = Math.max(...displayData) || 1;
    const deltaY = chartHeight / max;
  
    displayData.forEach((val, i) => {
      const barHeight = val > 0 ? val * deltaY : max * deltaY;
      const color = val === 0 
        ? new Color(barColor, 0.28) 
        : val == max 
        ? new Color('#FF5800') 
        : new Color(barColor);
  
      fillRect(ctx, i * 18, paddingTop + chartHeight - barHeight, 8, barHeight, 4, color);
    });
  
    return ctx.getImage();
  };
  
  // 设置组件背景
  const setBackground = async (widget) => {
    const bgImage = getBgImage();
    const Appearance = Device.isUsingDarkAppearance();
    if (fm.fileExists(bgImage) && !Appearance) {
      widget.backgroundImage = await shadowImage(fm.readImage(bgImage));
    } else if (setting.solidColor && !Appearance) {
      const gradient = new LinearGradient();
      const color = setting.gradient.length > 0 ? setting.gradient : [setting.rangeColor];
      const randomColor = await getRandomItem(color);
      // 渐变角度
      const angle = setting.angle;
      const radianAngle = ((360 - angle) % 360) * (Math.PI / 180);
      const x = 0.5 + 0.5 * Math.cos(radianAngle);
      const y = 0.5 + 0.5 * Math.sin(radianAngle);
      gradient.startPoint = new Point(1 - x, y);
      gradient.endPoint = new Point(x, 1 - y);
      
      gradient.locations = [0, 1];
      gradient.colors = [
        new Color(randomColor, setting.transparency),
        new Color('#00000000')
      ];
      widget.backgroundGradient = gradient;
    } else if (!Appearance && !setting.bwTheme) {
      widget.backgroundImage = await getCacheImage("bg.png", `${rootUrl}/img/picture/background_image_1.png`);
    } else {
      const baiTiaoUrl = [`${rootUrl}/img/background/glass_2.png`];
      const imageUrl = await getRandomItem(baiTiaoUrl);
      const name = imageUrl.split('/').pop();
      const randomBackgroundImage = await getCacheImage(name, imageUrl);
      widget.backgroundImage = randomBackgroundImage;
      widget.backgroundColor = Color.dynamic(Color.white(), Color.black());
    }
    
    if (count % 2 === 0) {
      levelColor = '#34C579'
      barColor = new Color(levelColor, 0.6);
    } else {
      levelColor = '#00BAFF'
      barColor = new Color(levelColor, 0.6);
    }
  };
  
  // createStack
  const createStack = (middleStack, spacer, month, total, money) => {
    const quotaStack = middleStack.addStack();  
    quotaStack.layoutVertically();
    quotaStack.centerAlignContent();
    
    const stack1 = quotaStack.addStack();
    if (spacer) stack1.addSpacer();
    const quotaText1 = stack1.addText(month);
    quotaText1.font = Font.mediumSystemFont(14);
    quotaText1.textOpacity = 0.7;
    if (!spacer) stack1.addSpacer();
    quotaStack.addSpacer(3);
    
    const stack2 = quotaStack.addStack();
    if (spacer) stack2.addSpacer();
    const quotaText2 = stack2.addText(`${total} °`);
    quotaText2.font = Font.boldSystemFont(18);
    if (!spacer) stack2.addSpacer();
    quotaStack.addSpacer(3);

    const stack3 = quotaStack.addStack();
    if (spacer) stack3.addSpacer();
    const quotaText3 = stack3.addText(money);
    quotaText3.font = Font.boldSystemFont(14);
    quotaText3.textOpacity = 0.7;
    if (!spacer) stack3.addSpacer();
  };
  
  //=========> Create <=========//
  const createWidget = async () => {
    const widget = new ListWidget();
    await setBackground(widget);
    widget.setPadding(0, 0, 0, 0);
    const mainStack = widget.addStack();
    mainStack.layoutVertically();
    mainStack.centerAlignContent();
    mainStack.setPadding(gap, gap, gap, gap);
    mainStack.addSpacer();
    
    // avatarStack
    const avatarStack = mainStack.addStack();
    avatarStack.layoutHorizontally();
    avatarStack.centerAlignContent();
    const avatarStack2 = avatarStack.addStack();
    
    const imgName = decodeURIComponent(avatar.substring(avatar.lastIndexOf("/") + 1));
    const iconSymbol = await getCacheImage(imgName, avatar);
    const avatarIcon = avatarStack2.addImage(iconSymbol);
    avatarIcon.imageSize = new Size(50, 50);
    avatarStack2.cornerRadius = Number(radius);
    avatarStack2.borderWidth = 3;
    avatarStack2.borderColor = new Color('#FFBF00');
    avatarStack.addSpacer(15);
    
    const topStack = avatarStack.addStack();
    topStack.layoutVertically();
    topStack.centerAlignContent();
    
    const levelStack = topStack.addStack();
    levelStack.layoutHorizontally();
    levelStack.centerAlignContent();
    
    const barStack = levelStack.addStack();
    barStack.layoutHorizontally();
    barStack.centerAlignContent();
    barStack.backgroundColor = new Color(levelColor);
    barStack.setPadding(1, 12, 1, 12)
    barStack.cornerRadius = 10;
    
    const iconSF = SFSymbol.named('crown.fill');
    const barIcon = barStack.addImage(iconSF.image);
    barIcon.imageSize = new Size(20, 20);
    barIcon.tintColor = new Color('#FDDA0D');
    barStack.addSpacer(4);
    
    const titleText = barStack.addText(name);
    titleText.font = Font.boldSystemFont(14);
    titleText.textColor = Color.white();
    levelStack.addSpacer(8);
    
    const beneStack = levelStack.addStack();
    beneStack.layoutHorizontally();
    beneStack.centerAlignContent();
    const benefitText = beneStack.addText('昨日 ');
    benefitText.font = Font.boldSystemFont(14);  
    benefitText.textOpacity = 0.7;
    
    const benefitText2 = beneStack.addText(`${ystdayPower} °`)
    benefitText2.font = Font.boldSystemFont(16);
    benefitText2.textColor = isArrears == 1 ? Color.blue() : Color.red();
    beneStack.addSpacer();
    
    if (isArrears == 1) {
      const payText0 = beneStack.addText(arrears);
      payText0.font = Font.boldSystemFont(16);
      payText0.textColor = new Color('#FF2400');
    } else if (setting.estimate) {
      const estimate = totalElectricity / total * totalPower
      const payText0 = beneStack.addText(isNaN(estimate) ? '0.00' : estimate === 0 ? balance : estimate.toFixed(2));
      payText0.font = Font.mediumSystemFont(16);
      payText0.textColor = Color.blue();
    }
    topStack.addSpacer(5);
    
    const pointStack = topStack.addStack();
    pointStack.layoutHorizontally();
    pointStack.centerAlignContent();
    
    const payStack = pointStack.addStack();
    payStack.layoutHorizontally();
    payStack.centerAlignContent();
    payStack.backgroundColor = new Color(isArrears == 1 ? '#D50000' : '#AF52DE');
    payStack.setPadding(2, 5, 2, 5);
    payStack.cornerRadius = 5;
    
    const payText = payStack.addText(!areaCode ? '用户未登录' : isArrears == 1 ? '待缴费' : '已缴费');
    payText.font = Font.boldSystemFont(11);
    payText.textColor = Color.white();
    pointStack.addSpacer(8);
    
    const LevelText = pointStack.addText(number);
    LevelText.font = Font.mediumSystemFont(14);
    LevelText.textOpacity = 0.7;
    pointStack.addSpacer();
    
    const barStack2 = pointStack.addStack();
    barStack2.layoutHorizontally();
    barStack2.centerAlignContent();
    barStack2.backgroundColor = new Color(count % 2 === 0 ? '#FFA61C' : '#00C400');
    barStack2.setPadding(1, 7, 1, 7);
    barStack2.cornerRadius = 5;
    
    const pointText = barStack2.addText(beforeYesterday);
    pointText.font = Font.boldSystemFont(13);
    pointText.textColor = Color.white();
    mainStack.addSpacer();
    
    // Switch position
    if (location == 0) {
      await progressBar(mainStack);
    }
    
    /** 
    * Middle or bottom Stack
    * @param {image} image
    * @param {string} string
    */
    const middleStack = mainStack.addStack();
    middleStack.layoutHorizontally();
    middleStack.centerAlignContent();
    
    createStack(middleStack, false, `${year}-${month}`, totalPower, (totalPower > 0 ? balance : '0.00'));
    middleStack.addSpacer();
    
    const totalItems = getTotalPower(totalArray);
    const n = totalItems.length;
    
    if (setting.chart && n > 0) {
      const chartColor = count % 2 === 0 ? '#8C7CFF' : '#34C579'
      const chartImage = createChart(totalItems.slice(-n), n, chartColor);
      const drawImage = middleStack.addImage(chartImage);
      drawImage.centerAlignImage();
      drawImage.imageSize = new Size(132, 60);
      drawImage.url = alipayUrl;
    } else {
      const icon = await getCacheImage('logo.png', 'https://kjimg10.360buyimg.com/jr_image/jfs/t1/205492/13/33247/3505/64ddf97fF4361af37/ffad1b1ba160d127.png');
      const iconElement = middleStack.addImage(icon);
      iconElement.imageSize = new Size(55, 55);
      iconElement.url = alipayUrl;
    };
    
    /** Middle Right Stack **/
    middleStack.addSpacer();
    createStack(middleStack, true, lastMonth, total, totalElectricity);
    mainStack.addSpacer();
    
    // Switch position
    if (location == 1) {
      await progressBar(mainStack);
    }
    arrearsNotice();
    return widget;
  };
  
  /** 
   * progressBar Stack
   * @param {image} image
   * @param {string} string
   */
  const progressBar = async (mainStack) => {
    const width = progressWidth;
    const height = 16;
    
    const prgsStack = mainStack.addStack();  
    prgsStack.layoutHorizontally();
    prgsStack.centerAlignContent();
      
    const curScoreText = prgsStack.addText(month);
    curScoreText.font = Font.boldSystemFont(13);
    prgsStack.addSpacer();
      
    const progress = prgsStack.addImage(creatProgress());
    progress.centerAlignImage();
    progress.imageSize = new Size(width, height);
    
    function creatProgress() {
      const isPercent = Math.max(0, Math.min(1, totalPower / total));
      
      const cxt = new DrawContext();
      cxt.opaque = false;
      cxt.respectScreenScale = true;
      cxt.size = new Size(width, height);
      
      const barPath = new Path();
      const barHeight = height - 10;
      barPath.addRoundedRect(new Rect(0, 5, width, barHeight), barHeight / 2, barHeight / 2);
      cxt.addPath(barPath);
      cxt.setFillColor(new Color(levelColor, 0.25));
      cxt.fillPath();
    
      const currPath = new Path();
      currPath.addRoundedRect(new Rect(0, 5, width * isPercent, barHeight), barHeight / 2, barHeight / 2);
      cxt.addPath(currPath);
      cxt.setFillColor(barColor);
      cxt.fillPath();
    
      const circlePath = new Path();
      const diameter = height * 0.85;
      circlePath.addEllipse(new Rect((width - diameter) * isPercent, (height - diameter) / 2, diameter, diameter));
      cxt.addPath(circlePath);
      cxt.setFillColor(new Color(levelColor));
      cxt.fillPath();
      
      return cxt.getImage();
    };
      
    prgsStack.addSpacer();
    const isPercent2 = total > 0 ? String(Math.floor(totalPower / total * 100)) : 0;
    const percentText = prgsStack.addText(`${isPercent2}%`);
    percentText.font = Font.boldSystemFont(13);  
    mainStack.addSpacer();
  };
  
  /**-------------------------**/
  const getLayout = (scr = Device.screenSize().height) => ({
    stackSize: scr < 926 ? 35 : 37,
    iconSize: scr < 926 ? 23 : 25,
    titleSize: scr < 926 ? 18 : 20,
    textSize: scr < 926 ? 11 : 11.5
  });
  
  // 添加到 widget
  const addVertical = async (horStack, iconName, iconColor, title, text, gap) => {
    const lay = getLayout();
    const rowStavk = horStack.addStack();
    rowStavk.layoutHorizontally();
    rowStavk.centerAlignContent();
    
    const iconStack = rowStavk.addStack();
    iconStack.layoutHorizontally();
    iconStack.centerAlignContent();
    iconStack.size = new Size(lay.stackSize, lay.stackSize);
    iconStack.cornerRadius = 50;
    iconStack.backgroundColor = iconColor;
    
    const iconSymbol = SFSymbol.named(iconName);
    const iconImage = iconStack.addImage(iconSymbol.image);
    iconImage.tintColor = Color.white();
    iconImage.imageSize = new Size(lay.iconSize, lay.iconSize);
    rowStavk.addSpacer(10);
    
    const verticalStack = rowStavk.addStack();
    verticalStack.layoutVertically();
    
    const titleText = verticalStack.addText(title);
    titleText.font = Font.mediumSystemFont(lay.titleSize);
    titleText.textColor = iconColor;
    
    const subtitleText = verticalStack.addText(text);
    subtitleText.font = Font.mediumSystemFont(lay.textSize);
    subtitleText.textOpacity = 0.65
    if (!gap) horStack.addSpacer();
    return horStack;
  };
  
  // 创建小号组件
  const createSmall = async () => {
    const response = await getCacheString(  
      `eleCar.json`,
      'https://95598.csg.cn/ucs/ma/zt/eleCar/getHomeInfo', {
      mobile: setting.mobile
    });
    
    const { 
      accFree = '0.00', 
      dayCharge = '0',
      monCharge = '0'
    } = response?.data || {};
    
    const widget = new ListWidget();
    const mainStack = widget.addStack();
    mainStack.setPadding(0, 0, 0, 0);
    mainStack.layoutHorizontally();
    mainStack.centerAlignContent();
    
    const horStack = mainStack.addStack();
    horStack.layoutVertically();
    
    addVertical(horStack, 'bolt.fill', Color.green(), Number(dayCharge).toFixed(2), '今日充电 (度)');
    addVertical(horStack, 'flame.fill', new Color('#FE4904'), Number(monCharge).toFixed(2), '本月充电 (度)');
    addVertical(horStack, 'dollarsign', Color.orange(), accFree, '当前余额 (元)', true);

    mainStack.addSpacer();
    return widget;
  };
  
  // 渲染组件
  const runWidget = async () => {
    const widget = await (family === 'medium' ? createWidget() : createSmall());
    
    if (config.runsInApp) {
      await widget[`present${family.charAt(0).toUpperCase() + family.slice(1)}`]();
    } else {
      widget.refreshAfterDate = new Date(Date.now() + 1000 * 60 * Number(setting.refresh));
      Script.setWidget(widget);
      Script.complete();
    }
  };
  await runWidget();
}
module.exports = { main }