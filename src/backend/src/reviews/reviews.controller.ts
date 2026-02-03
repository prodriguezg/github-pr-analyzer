import { Body, Controller, Post } from '@nestjs/common';
import { ReviewRequestDto } from './review-request.dto';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('reviews')
  async createReview(@Body() body: ReviewRequestDto) {
    return this.reviewsService.createReview(body);
  }
}
