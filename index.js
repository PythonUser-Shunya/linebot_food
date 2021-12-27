//strictモードを指定することで指定しない場合と比べ記述に対する制限が増え、エラーを積極的に発生させる
//将来的なエラーの早期発見や予防につながる
//webフック設定とエンドポイント設定忘れずに
"use strict";

//インスタンス化
const express = require("express");
const app = express();

const line = require("@line/bot-sdk");

// Bot用情報
const config = {
    channelSecret: "hogehoge",
    channelAccessToken: "hogehoge",
};
const client = new line.Client(config);

const util = require('util');

// LINE Botからのアクセスの一次処理。
app.post('/callback', line.middleware(config), (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
});
// イベントに対する返答を記述する部分
function handleEvent(event) {
    // ユーザーからBotに位置情報もしくはテキストが送られた場合以外は何もしない
    // 'postback'データの受け渡しが可能なアクション
    if ((event.type !== 'message' || (event.message.type !== 'location' && event.message.type !== 'text')) && event.type !== 'postback') {
        // ignore non-text-message event
        return Promise.resolve(null);
    }

    if (event.type == 'message' && event.message.type == 'location') {
        var liffUrl = util.format('hogehoge/?lat=%s&lon=%s', event.message.latitude, event.message.longitude);
        const templateMassage = {
            type: 'template',
            altText: '検索方法を指定',
            template: {
                type: 'buttons',
                title: '検索方法',
                text: '検索方法を選んで下さい。',
                actions: [{
                    label: '詳しい条件を指定',
                    type: 'uri',
                    uri: liffUrl
                },
                {
                    label: '今開いている店',
                    type: 'postback',
                    data: JSON.stringify({
                        'lat': event.message.latitude,
                        'lon': event.message.longitude
                    }),
                    displayText: 'now'
                }
                ],
            },
        }
        // 返信
        return client.replyMessage(event.replyToken, templateMassage);
    } else {
        var url
        if (event.type == 'postback') {

            var latlon = JSON.parse(event.postback.data)
            url = util.format('https://map.yahooapis.jp/search/local/V1/localSearch?appid=hogehoge&lat=%s&lon=%s&open=now&dist=3&output=json', latlon.lat, latlon.lon);
        } else {


            var searchQuery;
            try {
                searchQuery = JSON.parse(event.message.text)
            } catch (err) {
                console.log(err)
                const echo = {
                    'type': 'text',
                    'text': '始めに位置情報を送信して下さい。'
                }
                // 返信
                return client.replyMessage(event.replyToken, echo);
            }
            // ユーザーからBotにテキスト位置情報が送られた場合のみ以下が実行される
            var lat = searchQuery.lat
            var lon = searchQuery.lon
            var smoke = ['禁煙', '分煙', '喫煙可'].indexOf(searchQuery.smoke) + 1;
            var creditcard;
            switch (searchQuery.card) {
                case 'カード可':
                    creditcard = '&creditcard=true'
                    break
                case '問わない':
                    creditcard = ''
                    break
            }
            var week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']['月火水木金土日'.indexOf(searchQuery.day.substring(0, 1))]
            var hour = searchQuery.time.slice(0, -1)
            url = util.format('https://map.yahooapis.jp/search/local/V1/localSearch?appid=hogehoge&lat=%s&lon=%s&smoking=%i%s&open=%s,%s&dist=3&output=json', lat, lon, smoke, creditcard, week, hour);
        }
        var request = require('sync-request');
        var res = request('GET', url);
        var result = JSON.parse(res.getBody('utf8'));
        var restaurants = result.Feature

        var eachRestaurantLayoutTemplate = {
            "type": "bubble",
            "hero": {
                "type": "image",
                "url": "https://linecorp.com",
                "size": "full",
                "aspectRatio": "2:1",
                "aspectMode": "cover"
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [{
                    "type": "text",
                    "text": "Name",
                    "weight": "bold",
                    "size": "xl"
                },
                {
                    "type": "box",
                    "layout": "vertical",
                    "margin": "lg",
                    "spacing": "sm",
                    "contents": [{
                        "type": "box",
                        "layout": "baseline",
                        "spacing": "sm",
                        "contents": [{
                            "type": "text",
                            "text": "住所",
                            "color": "#aaaaaa",
                            "size": "sm",
                            "flex": 1
                        },
                        {
                            "type": "text",
                            "text": "Address",
                            "wrap": true,
                            "color": "#666666",
                            "size": "sm",
                            "flex": 3
                        }
                        ]
                    }]
                }
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "contents": [{
                    "type": "button",
                    "style": "link",
                    "height": "sm",
                    "action": {
                        "type": "uri",
                        "label": "経路",
                        "uri": "https://linecorp.com"
                    }
                },
                {
                    "type": "spacer",
                    "size": "sm"
                }
                ],
                "flex": 0
            }
        }

        var restaurantsLayout = []
        restaurants.forEach(function (restaurant) {
            var eachRestaurantLayout = JSON.parse(JSON.stringify(eachRestaurantLayoutTemplate));
            if (restaurant.Property.LeadImage != undefined) {
                eachRestaurantLayout.body.contents[0].text = restaurant.Name;
                eachRestaurantLayout.body.contents[1].contents[0].contents[1].text = restaurant.Property.Address;
                eachRestaurantLayout.hero.url = restaurant.Property.LeadImage.replace('http://', 'https://')
                eachRestaurantLayout.footer.contents[0].action.uri = util.format('https://www.google.com/maps?q=%s,%s', restaurant.Geometry.Coordinates.split(',')[1], restaurant.Geometry.Coordinates.split(',')[0])
                restaurantsLayout.push(eachRestaurantLayout)
            }
        });
        var carousel = {
            "type": "carousel",
            "contents": restaurantsLayout
        }
        // メッセージを構築
        const echo = {
            'type': 'flex',
            'altText': '検索結果',
            'contents': carousel
        }
        // 返信
        return client.replyMessage(event.replyToken, echo);
    }
}

// Webアプリケーションを開始
const port = process.env.PORT || 3000;
// publicフォルダを利用
//express.staticで静的ファイルの提供が可能になる
app.use(express.static('public'));
app.listen(port, () => {
    console.log(`listening on ${port}`);
});
