const axios = require("axios");
const FormData = require("form-data");

exports.handler = async function (context, event, callback) {
  console.log("Recognize start.");
  try {
    const data = new FormData();

    // Download from Twilio
    const res = await axios({
      method: "GET",
      url: `${event.RecordingUrl}.wav`,
      responseType: "stream",
      auth: {
        username: context.ACCOUNT_SID,
        password: context.AUTH_TOKEN,
      },
    });

    // Send to AMI Voice
    data.append("u", context.AMI_APP_KEY);
    data.append("d", `grammarFileNames=${context.AMI_ENGINE}`);
    data.append("c", "8k");
    data.append("a", res.data);
    const config = {
      method: "post",
      url: `${context.AMI_URL}`,
      headers: {
        ...data.getHeaders(),
      },
      data: data,
    };
    const result = await axios(config);
    console.log(`Recognize completed.`);
    console.dir(result.data);
    callback(null, {
      text: result.data.text,
    });
  } catch (err) {
    callback(err);
  }
};
