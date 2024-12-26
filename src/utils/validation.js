export const isValidComment = (comment) => {
    const minLength = 1; // 最小字符数
    const maxLength = 500; // 最大字符数
    const forbiddenWords = ['爸', '妈', '杀', '毒','爹','爷','母']; // 禁止的词汇
    const urlPattern = /(https?:\/\/[^\s]+)/g;

    if (comment.length < minLength || comment.length > maxLength) {
      return { valid: false, message: '评论长度不符合要求。' };
    }
  
    for (const word of forbiddenWords) {
      if (comment.includes(word)) {
        return { valid: false, message: '评论内容包含敏感词。' };
      }
    }

    // 检查链接
    if (urlPattern.test(comment)) {
      return { valid: false, message: '评论中不允许包含链接。' };
    }
  
    return { valid: true }; // 评论有效
  };