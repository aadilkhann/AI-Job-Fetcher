import {
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResumeService } from './resume.service';

const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

@Controller('resumes')
@UseGuards(JwtAuthGuard)
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  upload(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF and DOCX files are allowed');
    }
    return this.resumeService.upload(req.user.userId, {
      originalname: file.originalname,
      buffer: file.buffer,
      mimetype: file.mimetype,
    });
  }

  @Get()
  list(@Request() req: any) {
    return this.resumeService.findByUser(req.user.userId);
  }
}
