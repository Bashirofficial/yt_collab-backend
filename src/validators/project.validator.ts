import Joi from "joi";

export const updateProjectSchema = Joi.object({
  title: Joi.string().min(1).max(255).optional(),
  videoTitle: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).optional().allow(""),
  videoDescription: Joi.string().max(5000).optional().allow(""),
  keywords: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  visibility: Joi.string().valid("PUBLIC", "PRIVATE", "UNLISTED").optional(),
  thumbnail: Joi.string().uri().optional().allow(""),
  instructions: Joi.string().max(2000).optional().allow(""),
  projectType: Joi.string().valid("SINGLE", "SERIES").optional(),
  dueDate: Joi.date().iso().optional().allow(null),
  fullAccess: Joi.boolean().optional(),
  uploadAccess: Joi.boolean().optional(),
  downloadAccess: Joi.boolean().optional(),
  shareAccess: Joi.boolean().optional(),
}).min(1); // At least one field must be present
