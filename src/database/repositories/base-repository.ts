import { Repository, FindOptionsWhere } from 'typeorm';

/**
 * Base repository interface for all entities
 */
export interface IBaseRepository<T> {
  /**
   * Find an entity by ID
   */
  findById(id: string): Promise<T | null>;
  
  /**
   * Find entities by criteria
   */
  findBy(criteria: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T[]>;
  
  /**
   * Find one entity by criteria
   */
  findOneBy(criteria: FindOptionsWhere<T>): Promise<T | null>;
  
  /**
   * Save an entity
   */
  save(entity: T): Promise<T>;
  
  /**
   * Save multiple entities
   */
  saveMany(entities: T[]): Promise<T[]>;
  
  /**
   * Remove an entity
   */
  remove(entity: T): Promise<T>;
  
  /**
   * Get the TypeORM repository
   */
  getRepository(): Repository<T>;
}

/**
 * Base repository implementation
 */
export abstract class BaseRepository<T> implements IBaseRepository<T> {
  constructor(protected repository: Repository<T>) {}
  
  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as any });
  }
  
  async findBy(criteria: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T[]> {
    return this.repository.findBy(criteria);
  }
  
  async findOneBy(criteria: FindOptionsWhere<T>): Promise<T | null> {
    return this.repository.findOneBy(criteria);
  }
  
  async save(entity: T): Promise<T> {
    return this.repository.save(entity);
  }
  
  async saveMany(entities: T[]): Promise<T[]> {
    return this.repository.save(entities);
  }
  
  async remove(entity: T): Promise<T> {
    return this.repository.remove(entity);
  }
  
  getRepository(): Repository<T> {
    return this.repository;
  }
}
