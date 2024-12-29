// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: trophy;
/**
 * 组件作者: 95du茅台
 * 组件名称: 体育赛事排名
 * 组件版本: Version 1.0.0
 * 发布时间: 2024-12-28
 */


async function main(family) {
  const fm = FileManager.local();
  const depPath = fm.joinPath(fm.documentsDirectory(), '95du_module');
  const isDev = false
  
  if (typeof require === 'undefined') require = importModule;
  const { _95du } = require(isDev ? './_95du' : `${depPath}/_95du`);
  
  const pathName = '95du_sports_rank';
  const module = new _95du(pathName);
  const setting = module.settings;
  
  const { 
    rootUrl,
    settingPath, 
    cacheImg, 
    cacheStr,
  } = module;
  
  const paramMap = {
    '常规东部': { 
      type: '常规赛东部排名', 
      sport: 'NBA' 
    },
    '常规西部': { 
      type: '常规赛西部排名', 
      sport: 'NBA' 
    },
    '季前东部': { 
      type: '季前赛东部排名', 
      sport: 'NBA' 
    },
    '季前西部': { 
      type: '季前赛西部排名', 
      sport: 'NBA' 
    },
  };
  
  let chooseSports = setting.selected;
  const param = args.widgetParameter;
  if (param != null) {
    const matchedKey = Object.keys(paramMap).find(key => param.includes(key));
    if (matchedKey) {
      setting.type = paramMap[matchedKey].type;
      chooseSports = paramMap[matchedKey].sport;
    } else {
      const trimmedParam = param.trim();
      const validParam = setting.values.some(item => item.value === trimmedParam) || trimmedParam.includes('cba');
      setting.type = null;
      chooseSports = validParam ? trimmedParam : chooseSports;
    }
  } else if (setting.type) {
    chooseSports = 'NBA';
  }
  
  const textColor = Color.dynamic(new Color(setting.lightColor), new Color(setting.darkColor));
  
  // 获取排名
  const getMatchRankings = async (name, type = null) => {
    try {
      const url = `https://tiyu.baidu.com/al/match?match=${encodeURIComponent(name)}&tab=${encodeURIComponent('排名')}&request__node__params=1`;
      const { tplData } = await module.getCacheData(url, 6, `${name}.json`);
      const { tabsList, header } = tplData.data;
      // 提取数据列表
      const targetTab = tabsList?.[0]?.tabList?.[0];
      const list = tabsList?.length === 1 && targetTab?.data?.length === 1
        ? targetTab.data[0].list
        : tabsList
          ?.flatMap((tab) => tab.tabList)
          .find((tab) => tab?.data?.some((item) => !type || item.title === type))
          ?.data?.find((item) => !type || item.title === type)?.list;
      // 处理 record 数据
      const rankList = list.map((item) => {
        const [teamInfo, rounds, winDrawLoss, goals, points] = item.record;
        return {
          ...item,
          ...teamInfo,
          rounds,
          winDrawLoss,
          goals,
          points,
          record: undefined,
        };
      });
      return { header, rankList };
    } catch (error) {
      console.error(error.message);
      return [];
    }
  };
    
  // ====== 设置组件背景 ====== //
  const setBackground = async (widget) => {
    const bgImage = fm.joinPath(cacheImg, Script.name());
    if (fm.fileExists(bgImage)) {
      const shadowImg = fm.readImage(bgImage);
      widget.backgroundImage = await module.shadowImage(shadowImg);
    } else if (setting.gradient.length > 0 && !setting.bwTheme) {
      const gradient = new LinearGradient();
      const color = setting.gradient.length > 0 
        ? setting.gradient 
        : [setting.rangeColor];
      const randomColor = module.getRandomItem(color);
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
    } else {
      if (family === 'medium') {
        //const random = Math.floor(Math.random() * 4);
        const random = module.getRandomItem([0, 3]);
        const backgroundImage = await module.getCacheData(`${rootUrl}/img/background/player_${random}.png`);
        widget.backgroundImage = backgroundImage;
      } else if (setting.largeBg) {
        const random = Math.ceil(Math.random() * 6);
        const backgroundImage = await module.getCacheData(`${rootUrl}/img/background/football-player_${random}.png`);
        widget.backgroundImage = backgroundImage;
      }
      widget.backgroundColor = Color.dynamic(Color.white(), Color.black());
    }
  };
  
  const createText = (stack, text, textSize) => {
    const columnText = stack.addText(text);
    columnText.font = Font.mediumSystemFont(textSize || 13);
    columnText.textColor = textColor;
  };
  
  const addLeagueStack = async (widget, header) => {
    const leagueStack = widget.addStack();
    leagueStack.layoutHorizontally();
    leagueStack.centerAlignContent();
    const leagueImg = await module.getCacheData(header.logoimg, 240, `${header.name}.png`);
    const icon = leagueStack.addImage(leagueImg)
    icon.imageSize = new Size(23, 23);
    if (header.name.includes('法国')) {
      icon.tintColor = textColor;
    };
    leagueStack.addSpacer(12);
    
    createText(leagueStack, setting.type || header.name, 16);
    leagueStack.addSpacer();
    createText(leagueStack, header.info, 16);
    widget.addSpacer();
  };
  
  const createWidget = async () => {
    const { header, rankList } = await getMatchRankings(chooseSports, setting.type);
    const stackSize = ['cba', 'NBA'].includes(chooseSports) ? 150 : 200;
    const maxCol = family === 'medium' ? 6 : rankList.length >= setting.lines ? setting.lines : rankList.length;
    
    const widget = new ListWidget();
    widget.setPadding(15, 18, 15, 18);
    //widget.url = url;
    await setBackground(widget);
    if (family === 'large') await addLeagueStack(widget, header);
    
    for (let i = 0; i < maxCol; i++) {
      const team = rankList[i];
      const teamStack = widget.addStack();
      teamStack.layoutHorizontally();
      teamStack.centerAlignContent();
      
      const indexStack = teamStack.addStack();
      indexStack.size = new Size(20, 0);
      const indexText = indexStack.addText(team.rank);
      indexText.font = Font.boldSystemFont(15);
      const textColor = i <= 2 
        ? '#FF0000' : i <= 3
        ? '#FCA100' : '#00C400';
      indexText.textColor = new Color(textColor);
      teamStack.addSpacer(8);
      
      // 队标
      const teamLogoUrl = team.logo || ''; // 修复潜在错误
      if (teamLogoUrl) {
        const teamLogo = await module.getCacheData(teamLogoUrl, 240, `${team.name}.png`);
        const logoImg = teamStack.addImage(teamLogo);
        logoImg.imageSize = new Size(20, 20);
      }
      teamStack.addSpacer(12);
      
      const teamInfoStack = teamStack.addStack();
      teamInfoStack.centerAlignContent();
      teamInfoStack.size = new Size(stackSize, 0);
      createText(teamInfoStack, team.name);
      teamInfoStack.addSpacer(8);
      if (team.fillsName) {
        const barStack = teamInfoStack.addStack();
        barStack.layoutHorizontally();
        barStack.setPadding(0.5, 5, 0.5, 5)
        barStack.cornerRadius = 5
        barStack.backgroundColor = Color.blue();
        const fillText = barStack.addText(team.fillsName);
        fillText.font = Font.boldSystemFont(11);
        fillText.textColor = Color.white()
      }
      
      teamInfoStack.addSpacer();
      const roundStack = teamStack.addStack();
      createText(roundStack, team.rounds);
      roundStack.addSpacer();
      createText(teamStack, team.points || team.goals);
          
      if (i !== maxCol - 1) {
        widget.addSpacer(3);
      }
    };
    return widget;
  };
  
  const createErrorWidget = () => {
    const widget = new ListWidget();
    const text = widget.addText('仅支持中大尺寸');
    text.font = Font.systemFont(16);
    text.centerAlignText();
    return widget;
  };
  
  // 渲染组件
  const runWidget = async () => {
    const widget = family === 'small' ? createErrorWidget() : await createWidget();
    if (setting.alwaysDark) {
      widget.backgroundColor =  Color.black();
    }
    
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