// 文件名： api/proxy.js

export default async function handler(request, response) {
  // 只接受 POST 请求
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  // --- 安全验证 ---
  // 从 Vercel 环境变量中获取您设置的“暗号”
  const FEISHU_SECRET = process.env.FEISHU_SECRET;
  // 从飞书请求的 Header 中获取“暗号”
  const requestSecret = request.headers['x-secret-token'];

  if (FEISHU_SECRET && requestSecret !== FEISHU_SECRET) {
    // 如果暗号不匹配，拒绝访问
    return response.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // --- 获取飞书发来的指令 ---
    // request.body 的格式应该是 {"prompt": "您要问的问题"}
    const { prompt } = request.body;

    if (!prompt) {
      return response.status(400).json({ error: 'Missing prompt in body' });
    }

    // --- 从 Vercel 环境变量中获取 Google API Key ---
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) {
      return response.status(500).json({ error: 'Missing GOOGLE_API_KEY environment variable' });
    }

    // --- 准备调用 Google API ---
    // 【重点】这里我们用您想要的 Pro 模型！
    const GOOGLE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GOOGLE_API_KEY}`;

    const googleRequestBody = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    // --- 发起请求（Vercel 在海外，速度极快）---
    const googleRes = await fetch(GOOGLE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googleRequestBody),
    });

    if (!googleRes.ok) {
      // 如果 Google 返回错误
      const errorText = await googleRes.text();
      return response.status(googleRes.status).json({ error: 'Google API Error', details: errorText });
    }

    const googleData = await googleRes.json();

    // --- 提取结果并返回给飞书 ---
    const resultText = googleData.candidates[0].content.parts[0].text;

    // 【重要】将结果用飞书能识别的格式返回
    // 飞书的“发送HTTP请求”节点会将这个JSON结果作为输出，供后续步骤使用
    response.status(200).json({ 
      success: true, 
      gemini_result: resultText 
    });

  } catch (error) {
    // 处理其他未知错误
    response.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
