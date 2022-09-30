const axios = require('axios');
const { setTimeout } = require('node:timers');
const FormData = require('form-data');

exports.handler = async function (context, event, callback) {
  console.log('Recognize start.');
  try {
    const formData = new FormData();

    // Wait one second.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Download from Twilio
    const res = await axios({
      method: 'GET',
      url: `${event.RecordingUrl}.wav`,
      responseType: 'stream',
      auth: {
        username: context.ACCOUNT_SID,
        password: context.AUTH_TOKEN,
      },
    });
    console.log(`🐞 recording downloaded.`);

    // Send to AMI Voice
    formData.append('u', context.AMI_APP_KEY);
    formData.append('d', `grammarFileNames=${context.AMI_ENGINE}`);
    formData.append('c', '8k');
    formData.append('a', res.data);
    const config = {
      method: 'post',
      url: `${context.AMI_URL}`,
      headers: {
        ...formData.getHeaders(),
      },
      data: formData,
    };
    const result = await axios(config);
    console.log(`Recognize completed.`);
    console.dir(result.data);
    callback(null, {
      text: result.data.text,
    });
  } catch (err) {
    console.log(`👺 ERROR: ${err}`);
    callback(err);
  }
};
