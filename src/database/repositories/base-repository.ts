import { Repository, FindOptionsWhere, ObjectLiteral } from 'typeorm';

/**
 * Base repository interface for all entities
 */
export interface IBaseRepository<T extends ObjectLiteral> {
  /**
   * Find an entity by ID
   */
  findById(id: string): Promise<T | null>;
  
  /**
   * Find all entities
   */
  findAll(): Promise<T[]>;
  
  /**
   * Save an entity
   */
  save(entity: T): Promise<T>;
  
  /**
   * Remove an entity
   */
  remove(entity: T): Promise<T>;
  
  /**
   * Find entities by criteria
   */
  findBy(criteria: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T[]>;
  
  /**
   * Find one entity by criteria
   */
  findOneBy(criteria: FindOptionsWhere<T>): Promise<T | null>;
  
  /**
   * Save multiple entities
   */
  saveMany(entities: T[]): Promise<T[]>;
  
  /**
   * Delete an entity
   */
  delete(id: string): Promise<void>;
  
  /**
   * Get the TypeORM repository
   */
  getRepository(): Repository<T>;
}

/**
 * Base repository implementation
 */
export class BaseRepository<T extends ObjectLiteral> implements IBaseRepository<T> {
  constructor(protected repository: Repository<T>) {}
  
  /**
   * Find an entity by ID
   */
  async findById(id: string): Promise<T | null> {
    return this.repository.findOneBy({ id } as unknown as FindOptionsWhere<T>);
  }
  
  /**
   * Find all entities
   */
  async findAll(): Promise<T[]> {
    return this.repository.find();
  }
  
  /**
   * Save an entity
   */
  async save(entity: T): Promise<T> {
    return this.repository.save(entity);
  }
  
  /**
   * Remove an entity
   */
  async remove(entity: T): Promise<T> {
    return this.repository.remove(entity);
  }
  
  /**
   * Find entities by criteria
   */
  async findBy(criteria: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T[]> {
    return this.repository.findBy(criteria);
  }
  
  /**
   * Find one entity by criteria
   */
  async findOneBy(criteria: FindOptionsWhere<T>): Promise<T | null> {
    return this.repository.findOneBy(criteria);
  }
  
  /**
   * Save multiple entities
   */
  async saveMany(entities: T[]): Promise<T[]> {
    return this.repository.save(entities);
  }
  
  /**
   * Delete an entity
   */
  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
  
  /**
   * Get the TypeORM repository
   */
  getRepository(): Repository<T> {
    return this.repository;
  }
}
