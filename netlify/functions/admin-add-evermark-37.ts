import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Use service key for admin operations
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const evermarkData = {
      token_id: 37,
      title: 'An ecological theory of learning transfer in human activity',
      author: 'Gavan Lintern et al.',
      owner: '0x3427b4716B90C11F9971e43999a48A47Cf5B571E',
      description: 'Paper by Gavan Lintern, Peter N. Kugler, Al Motavalli published in Theoretical Issues in Ergonomics Science (2024)',
      content_type: 'DOI',
      source_url: 'https://doi.org/10.1080/1463922x.2024.2365429',
      token_uri: 'ar://pTMOmqE5OSkzI5-D3-To0BwdcxNI9GrlmL4fwnq-w4Y',
      created_at: '2025-09-24T05:09:45.442Z',
      updated_at: '2025-09-24T05:09:45.442Z',
      verified: true,
      metadata_fetched: true,
      tx_hash: '0x0463f513636b4ac3bf6a928e973f8608ca704b269af78e1427deb1d574bf52d9',
      metadata_json: JSON.stringify({
        "title": "An ecological theory of learning transfer in human activity",
        "authors": ["Gavan Lintern", "Peter N. Kugler", "Al Motavalli"],
        "primaryAuthor": "Gavan Lintern et al.",
        "journal": "Theoretical Issues in Ergonomics Science",
        "publisher": "Informa UK Limited",
        "publishedDate": "2024-6-13",
        "volume": "26",
        "issue": "1",
        "pages": "12-44",
        "doi": "10.1080/1463922X.2024.2365429",
        "backend": "ardrive",
        "arweaveUrl": "https://arweave.net/GHxj5TPFpTBOCuOShiJNTuHj7ocBFUz5-3XsOoBRJ84",
        "seasonNumber": 7,
        "seasonYear": 2025,
        "seasonWeek": 39,
        "seasonPhase": "voting",
        "image": {
          "url": "https://arweave.net/GHxj5TPFpTBOCuOShiJNTuHj7ocBFUz5-3XsOoBRJ84",
          "size": 91432
        },
        "tags": ["research", "paper", "article", "2025"],
        "creator": "0x3427b4716B90C11F9971e43999a48A47Cf5B571E",
        "createdAt": "2025-09-24T05:09:45.442Z"
      })
    };

    const { data, error } = await supabase
      .from('beta_evermarks')
      .insert([evermarkData])
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to insert evermark', details: error })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, evermark: data })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};