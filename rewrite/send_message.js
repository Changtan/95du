// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: car;
await sendMessage();
  
async function sendMessage() {
  const url = 'https://api.telegram.org/bot7967816926:AAEe2Mue02NTGAuIuQHxsyorKXxEsRzK7L4/sendPhoto';
  const req = new Request(url);
  req.method = 'POST';
  req.headers = { 'Content-Type': 'application/json' };
  req.body = JSON.stringify({
    chat_id: "5635611671",
    photo: "https://image.fosunholiday.com/cl/image/comment/675dd9aa45fc72782a7dd2a8_upload.png",
    caption: `*英格兰超级联赛* 2024\\-2025
🔗 [点击访问主页](https://tiyu.baidu.com/match/英超/date_time/2024-12-15/tab/赛程/from/baidu_aladdin)

*英超第15轮*
~21:00 已结束~
||利物浦 2 : 2 富勒姆||

• [排名](https://tiyu.baidu.com/match/英超/tab/排名/rankChildTab/teamRank/current/0)
• [赛程](https://tiyu.baidu.com/match/英超/tab/赛程)
• [球队榜](https://tiyu.baidu.com/match/英超/tab/球队榜/current/0)

>*下一场比赛*
>第 16 轮
>12月20日 23:30  阿森纳 \\-  曼城

>*查看更多\\>*
>It is separated from the previous block quotation by an empty bold entity  
>Expandable block quotation continued  
>The last line of the expandable block quotation with the expandability mark||
    `,
    parse_mode: "MarkdownV2"
  });
  req.timeoutInterval = 10;
  return await req.loadJSON();
}