const Joi = require('joi');

// 通用驗證中介軟體
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // 回傳所有錯誤
      stripUnknown: true, // 移除未定義的欄位
      convert: true // 自動轉換型別
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '輸入資料格式錯誤',
          details: errors
        },
        timestamp: new Date().toISOString()
      });
    }

    // 將驗證後的資料替換原始資料
    req[property] = value;
    next();
  };
};

// 驗證 schema 定義
const schemas = {
  // 位置更新驗證
  locationUpdate: Joi.object({
    lat: Joi.number()
      .min(-90)
      .max(90)
      .required()
      .messages({
        'number.base': '緯度必須是數字',
        'number.min': '緯度不能小於 -90',
        'number.max': '緯度不能大於 90',
        'any.required': '緯度為必填欄位'
      }),
    lng: Joi.number()
      .min(-180)
      .max(180)
      .required()
      .messages({
        'number.base': '經度必須是數字',
        'number.min': '經度不能小於 -180',
        'number.max': '經度不能大於 180',
        'any.required': '經度為必填欄位'
      })
  }),

  // 播放記錄驗證
  playbackRecord: Joi.object({
    track_data: Joi.object({
      id: Joi.string().required().messages({
        'string.base': '歌曲 ID 必須是字串',
        'any.required': '歌曲 ID 為必填欄位'
      }),
      name: Joi.string().max(500).required().messages({
        'string.base': '歌曲名稱必須是字串',
        'string.max': '歌曲名稱不能超過 500 字元',
        'any.required': '歌曲名稱為必填欄位'
      }),
      artist: Joi.string().max(500).required().messages({
        'string.base': '藝人名稱必須是字串',
        'string.max': '藝人名稱不能超過 500 字元',
        'any.required': '藝人名稱為必填欄位'
      }),
      album: Joi.string().max(500).optional().messages({
        'string.base': '專輯名稱必須是字串',
        'string.max': '專輯名稱不能超過 500 字元'
      }),
      image_url: Joi.string().uri().optional().messages({
        'string.base': '圖片 URL 必須是字串',
        'string.uri': '圖片 URL 格式錯誤'
      }),
      progress_ms: Joi.number().min(0).optional().messages({
        'number.base': '播放進度必須是數字',
        'number.min': '播放進度不能小於 0'
      }),
      is_playing: Joi.boolean().optional().messages({
        'boolean.base': '播放狀態必須是布林值'
      })
    }).required().messages({
      'object.base': '歌曲資料必須是物件',
      'any.required': '歌曲資料為必填欄位'
    }),
    
    location: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required()
    }).required().messages({
      'object.base': '位置資料必須是物件',
      'any.required': '位置資料為必填欄位'
    }),
    
    hex_id: Joi.string().pattern(/^[0-9a-f]+$/).required().messages({
      'string.base': 'Hex ID 必須是字串',
      'string.pattern.base': 'Hex ID 格式錯誤',
      'any.required': 'Hex ID 為必填欄位'
    })
  }),

  // 刷新 token 驗證
  refreshToken: Joi.object({
    refresh_token: Joi.string().required().messages({
      'string.base': 'Refresh token 必須是字串',
      'any.required': 'Refresh token 為必填欄位'
    })
  }),

  // 查詢參數驗證
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      'number.base': '每頁筆數必須是數字',
      'number.integer': '每頁筆數必須是整數',
      'number.min': '每頁筆數不能小於 1',
      'number.max': '每頁筆數不能大於 100'
    }),
    offset: Joi.number().integer().min(0).default(0).messages({
      'number.base': '偏移量必須是數字',
      'number.integer': '偏移量必須是整數',
      'number.min': '偏移量不能小於 0'
    })
  }),

  // 地圖範圍驗證
  mapBounds: Joi.object({
    north: Joi.number().min(-90).max(90).required(),
    south: Joi.number().min(-90).max(90).required(),
    east: Joi.number().min(-180).max(180).required(),
    west: Joi.number().min(-180).max(180).required()
  }).custom((value, helpers) => {
    if (value.north <= value.south) {
      return helpers.error('custom.northSouth');
    }
    return value;
  }).messages({
    'custom.northSouth': '北邊界必須大於南邊界'
  })
};

module.exports = {
  validate,
  schemas
};